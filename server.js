require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const Database = require('better-sqlite3');
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const app = express();
const db = new Database('pitchthehack.db');

// Updated schema: projects have revisions, provenance URL for uniqueness
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    githubId TEXT UNIQUE,
    username TEXT,
    displayName TEXT,
    avatarUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    title TEXT,
    provenanceUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    UNIQUE(userId, provenanceUrl)
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    revisionNumber INTEGER,
    description TEXT,
    story TEXT,
    imageUrl TEXT,
    videoUrl TEXT,
    githubUrl TEXT,
    websiteUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revisionId INTEGER,
    userId INTEGER,
    whatDoesItDo TEXT,
    problemItSolves TEXT,
    whoIsItFor TEXT,
    howToUse TEXT,
    isCorrectWhatDoesItDo INTEGER DEFAULT NULL,
    isCorrectProblem INTEGER DEFAULT NULL,
    isCorrectWhoIsFor INTEGER DEFAULT NULL,
    isCorrectHowToUse INTEGER DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (revisionId) REFERENCES revisions(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS hackathons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    title TEXT,
    description TEXT,
    imageUrl TEXT,
    startDate DATETIME,
    endDate DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS hackathon_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hackathonId INTEGER,
    userId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hackathonId) REFERENCES hackathons(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    UNIQUE(hackathonId, userId)
  );

  CREATE TABLE IF NOT EXISTS hackathon_meetups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hackathonId INTEGER,
    userId INTEGER,
    location TEXT,
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hackathonId) REFERENCES hackathons(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// Create demo user if not exists (for when OAuth is disabled)
const demoUser = db.prepare('SELECT * FROM users WHERE id = 1').get();
if (!demoUser) {
  db.prepare('INSERT INTO users (id, username, displayName) VALUES (1, ?, ?)').run('demo', 'Demo User');
}

app.use(express.static('public'));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user);
});

// OAuth disabled - GitHub strategy commented out for demo mode

// Helper to fetch URL content with timeout
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Parse Devpost page to extract project data
function parseDevpost(html, url) {
  const result = {
    title: '',
    description: '',     // short description from p class="large"
    story: '',           // longer story from #app-details-left
    imageUrl: '',        // og:image for project card
    githubUrl: '',
    websiteUrl: '',
    videoUrl: ''
  };

  const $ = cheerio.load(html);

  // Title from og:title meta tag
  result.title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';

  // Short description from p class="large"
  const shortDesc = $('p.large').first().text().trim();
  result.description = shortDesc;

  // Story from #app-details-left - get the content div between gallery and built-with
  const appDetailsLeft = $('#app-details-left');
  if (appDetailsLeft.length > 0) {
    // Get children and find the story div (the one after gallery, before built-with)
    const children = appDetailsLeft.children();
    let storyDiv = null;
    
    for (let i = 0; i < children.length; i++) {
      const $child = $(children[i]);
      // Skip gallery, find the div before built-with
      if ($child.attr('id') === 'gallery') continue;
      if ($child.attr('id') === 'built-with') break;
      if ($child.is('div') && !$child.attr('id')) {
        storyDiv = $child;
        break;
      }
    }
    
    if (storyDiv && storyDiv.length > 0) {
      const storyParts = [];
      
      // Check if there are h2 headings (structured content)
      const headings = storyDiv.find('h2');
      if (headings.length > 0) {
        // Get all h2 headings and their following paragraphs
        headings.each((_, el) => {
          const $el = $(el);
          const headingText = $el.text().trim();
          if (headingText) storyParts.push(headingText);
          
          // Get paragraphs after this heading until next h2
          let $next = $el.next();
          while ($next.length > 0 && !$next.is('h2')) {
            if ($next.is('p')) {
              const text = $next.text().trim();
              if (text && text.length > 10) {
                storyParts.push(text);
              }
            }
            $next = $next.next();
          }
        });
      } else {
        // No headings - just get all paragraphs
        storyDiv.find('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 10) {
            storyParts.push(text);
          }
        });
      }
      
      if (storyParts.length > 0) {
        result.story = storyParts.join('\n\n');
      }
    }
  }

  // Extract YouTube video URL from iframe embed
  const videoEmbed = appDetailsLeft.find('iframe.video-embed, iframe[src*="youtube.com/embed"]').first();
  if (videoEmbed.length > 0) {
    const src = videoEmbed.attr('src') || '';
    const videoIdMatch = src.match(/embed\/([a-zA-Z0-9_-]+)/);
    if (videoIdMatch) {
      result.videoUrl = `https://youtube.com/watch?v=${videoIdMatch[1]}`;
    }
  }

  // Extract GitHub URL from "Try it out" section
  const tryItOutSection = $('h2').filter((_, el) => $(el).text().trim().toLowerCase() === 'try it out').parent();
  if (tryItOutSection.length > 0) {
    const githubLink = tryItOutSection.find('a[href*="github.com"]').first();
    if (githubLink.length > 0) {
      result.githubUrl = githubLink.attr('href') || '';
    }
  }
  // Fallback: any github.com link in the page
  if (!result.githubUrl) {
    const githubLink = $('a[href*="github.com"]').first();
    if (githubLink.length > 0) {
      result.githubUrl = githubLink.attr('href') || '';
    }
  }

  // Extract website URL from "Try it out" section (not devpost itself)
  if (tryItOutSection.length > 0) {
    const websiteLink = tryItOutSection.find('a[href]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return !href.includes('devpost.com');
    }).first();
    if (websiteLink.length > 0) {
      result.websiteUrl = websiteLink.attr('href') || '';
    }
  }

  // Extract og:image for project card
  result.imageUrl = $('meta[property="og:image"]').attr('content') || '';

  return result;
}

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

// Demo mode - always return a demo user (OAuth disabled)
app.get('/api/me', (req, res) => {
  res.json({ id: 1, username: 'demo', displayName: 'Demo User', avatarUrl: '' });
});

// OAuth disabled - logout does nothing in demo mode
app.post('/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// Get a user by ID
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const user = db.prepare('SELECT id, username, displayName, avatarUrl FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Get all projects for a user (public profile)
app.get('/api/users/:id/projects', (req, res) => {
  const userId = req.params.id;
  const projects = db.prepare(`
    SELECT p.*, 
           r.description as latestDescription,
           r.story as latestStory,
           r.imageUrl as latestImageUrl,
           r.videoUrl as latestVideoUrl,
           r.githubUrl as latestGithubUrl,
           r.websiteUrl as latestWebsiteUrl,
           r.revisionNumber,
           (SELECT COUNT(*) FROM responses WHERE revisionId = r.id) as responseCount
    FROM projects p
    LEFT JOIN revisions r ON r.id = (
      SELECT id FROM revisions WHERE projectId = p.id ORDER BY revisionNumber DESC LIMIT 1
    )
    WHERE p.userId = ?
    ORDER BY p.createdAt DESC
  `).all(userId);
  res.json(projects);
});

// Get all projects for user (with latest revision info)
app.get('/api/projects', (req, res) => {
  const userId = 1; // Demo user
  const projects = db.prepare(`
    SELECT p.*, 
           r.description as latestDescription,
           r.story as latestStory,
           r.imageUrl as latestImageUrl,
           r.videoUrl as latestVideoUrl,
           r.githubUrl as latestGithubUrl,
           r.websiteUrl as latestWebsiteUrl,
           r.revisionNumber,
           u.username, u.displayName, u.avatarUrl,
           (SELECT COUNT(*) FROM responses WHERE revisionId = r.id) as responseCount
    FROM projects p
    JOIN users u ON p.userId = u.id
    LEFT JOIN revisions r ON r.id = (
      SELECT id FROM revisions WHERE projectId = p.id ORDER BY revisionNumber DESC LIMIT 1
    )
    WHERE p.userId = ?
    ORDER BY p.createdAt DESC
  `).all(userId);
  res.json(projects);
});

// Get a single project with all revisions and responses
app.get('/api/projects/:id', (req, res) => {
  const projectId = req.params.id;
  const project = db.prepare(`
    SELECT p.*, u.username, u.displayName, u.avatarUrl
    FROM projects p
    JOIN users u ON p.userId = u.id
    WHERE p.id = ?
  `).get(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const revisions = db.prepare(`
    SELECT r.id, r.projectId, r.revisionNumber, r.description, r.story, r.videoUrl, r.githubUrl, r.websiteUrl, r.createdAt,
           (SELECT COUNT(*) FROM responses WHERE revisionId = r.id) as responseCount
    FROM revisions r
    WHERE r.projectId = ?
    ORDER BY r.revisionNumber DESC
  `).all(projectId);
  
  // Get responses for each revision
  for (const rev of revisions) {
    rev.responses = db.prepare(`
      SELECT resp.id, resp.revisionId, resp.userId, resp.whatDoesItDo, resp.problemItSolves, resp.whoIsItFor, resp.howToUse,
             resp.isCorrectWhatDoesItDo, resp.isCorrectProblem, resp.isCorrectWhoIsFor, resp.isCorrectHowToUse,
             resp.createdAt, u.username, u.displayName
      FROM responses resp
      JOIN users u ON resp.userId = u.id
      WHERE resp.revisionId = ?
      ORDER BY resp.createdAt DESC
    `).all(rev.id);
  }
  
  project.revisions = revisions;
  res.json(project);
});

// Create new project (or find existing by provenance) with first revision
app.post('/api/projects', async (req, res) => {
  const userId = 1; // Demo user
  const { title, description, story, imageUrl, videoUrl, githubUrl, websiteUrl, provenanceUrl, ...pitchAnswers } = req.body;
  
  if (!title || title.length > 200) {
    return res.status(400).json({ error: 'Title is required (max 200 chars)' });
  }
  if (!description || description.length > 2000) {
    return res.status(400).json({ error: 'Description is required (max 2000 chars)' });
  }
  
  let projectId;
  
  // Check if project already exists for this user with same provenance
  if (provenanceUrl) {
    const existing = db.prepare(
      'SELECT id FROM projects WHERE userId = ? AND provenanceUrl = ?'
    ).get(userId, provenanceUrl);
    
    if (existing) {
      projectId = existing.id;
      // Add a new revision to existing project
      const maxRev = db.prepare(
        'SELECT MAX(revisionNumber) as max FROM revisions WHERE projectId = ?'
      ).get(projectId);
      const newRevNum = (maxRev.max || 0) + 1;
      
      const revResult = db.prepare(`
        INSERT INTO revisions (projectId, revisionNumber, description, story, videoUrl, githubUrl, websiteUrl)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, newRevNum, description, story || '', videoUrl || '', githubUrl || '', websiteUrl || '');
      
      // If pitch creator answered the 4 questions, create a self-response
      if (pitchAnswers.whatDoesItDo || pitchAnswers.problemItSolves || pitchAnswers.whoIsItFor || pitchAnswers.howToUse) {
        db.prepare(`
          INSERT INTO responses (revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(revResult.lastInsertRowid, userId, pitchAnswers.whatDoesItDo || '', pitchAnswers.problemItSolves || '', pitchAnswers.whoIsItFor || '', pitchAnswers.howToUse || '');
      }
      
      return res.json({ id: projectId, revisionNumber: newRevNum, isNewRevision: true });
    }
  }
  
  // Create new project
  const result = db.prepare(
    'INSERT INTO projects (userId, title, provenanceUrl) VALUES (?, ?, ?)'
  ).run(userId, title, provenanceUrl || '');
  
  projectId = result.lastInsertRowid;
  
  // Get og:image from Devpost if we have a provenance URL, or use provided imageUrl
  let finalImageUrl = imageUrl || '';
  if (!finalImageUrl && provenanceUrl) {
    try {
      const html = await fetchUrl(provenanceUrl);
      const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (imgMatch) finalImageUrl = imgMatch[1];
    } catch (e) { /* ignore fetch errors */ }
  }
  
  // Create first revision
  const revResult = db.prepare(`
    INSERT INTO revisions (projectId, revisionNumber, description, story, imageUrl, videoUrl, githubUrl, websiteUrl)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)
  `).run(projectId, description, story || '', finalImageUrl, videoUrl || '', githubUrl || '', websiteUrl || '');
  
  // If pitch creator answered the 4 questions, create a self-response
  if (pitchAnswers.whatDoesItDo || pitchAnswers.problemItSolves || pitchAnswers.whoIsItFor || pitchAnswers.howToUse) {
    db.prepare(`
      INSERT INTO responses (revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(revResult.lastInsertRowid, userId, pitchAnswers.whatDoesItDo || '', pitchAnswers.problemItSolves || '', pitchAnswers.whoIsItFor || '', pitchAnswers.howToUse || '');
  }
  
  res.json({ id: projectId, revisionNumber: 1, isNewProject: true });
});

// Add a new revision to an existing project
app.post('/api/projects/:id/revisions', (req, res) => {
  const projectId = req.params.id;
  const userId = 1; // Demo user
  const { description, story, videoUrl, githubUrl, websiteUrl, ...pitchAnswers } = req.body;
  
  if (!description || description.length > 2000) {
    return res.status(400).json({ error: 'Description is required (max 2000 chars)' });
  }
  
  const maxRev = db.prepare(
    'SELECT MAX(revisionNumber) as max FROM revisions WHERE projectId = ?'
  ).get(projectId);
  
  const newRevNum = (maxRev.max || 0) + 1;
  
  const revResult = db.prepare(`
    INSERT INTO revisions (projectId, revisionNumber, description, story, videoUrl, githubUrl, websiteUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, newRevNum, description, story || '', videoUrl || '', githubUrl || '', websiteUrl || '');
  
  // If pitch creator answered the 4 questions, create a self-response
  if (pitchAnswers.whatDoesItDo || pitchAnswers.problemItSolves || pitchAnswers.whoIsItFor || pitchAnswers.howToUse) {
    db.prepare(`
      INSERT INTO responses (revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(revResult.lastInsertRowid, userId, pitchAnswers.whatDoesItDo || '', pitchAnswers.problemItSolves || '', pitchAnswers.whoIsItFor || '', pitchAnswers.howToUse || '');
  }
  
  res.json({ revisionNumber: newRevNum });
});

// Submit a response (audience answers the 4 decoding questions)
app.post('/api/revisions/:id/responses', (req, res) => {
  const revisionId = req.params.id;
  const userId = 1; // Demo user
  const { whatDoesItDo, problemItSolves, whoIsItFor, howToUse } = req.body;
  
  // All 4 fields are optional - people can skip any they want
  if (!whatDoesItDo && !problemItSolves && !whoIsItFor && !howToUse) {
    return res.status(400).json({ error: 'At least one question must be answered' });
  }
  
  const result = db.prepare(`
    INSERT INTO responses (revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(revisionId, userId, whatDoesItDo || '', problemItSolves || '', whoIsItFor || '', howToUse || '');
  
  res.json({ id: result.lastInsertRowid });
});

// Rate a response (hacker marks each answer correct or incorrect)
app.patch('/api/responses/:id/rate', (req, res) => {
  const responseId = req.params.id;
  const { isCorrectWhatDoesItDo, isCorrectProblem, isCorrectWhoIsFor, isCorrectHowToUse } = req.body;
  
  // Each rating field must be 0, 1, or null (to clear)
  const validValues = [0, 1, null];
  if (isCorrectWhatDoesItDo !== undefined && !validValues.includes(isCorrectWhatDoesItDo)) {
    return res.status(400).json({ error: 'Rating must be 0, 1, or null' });
  }
  if (isCorrectProblem !== undefined && !validValues.includes(isCorrectProblem)) {
    return res.status(400).json({ error: 'Rating must be 0, 1, or null' });
  }
  if (isCorrectWhoIsFor !== undefined && !validValues.includes(isCorrectWhoIsFor)) {
    return res.status(400).json({ error: 'Rating must be 0, 1, or null' });
  }
  if (isCorrectHowToUse !== undefined && !validValues.includes(isCorrectHowToUse)) {
    return res.status(400).json({ error: 'Rating must be 0, 1, or null' });
  }
  
  if (isCorrectWhatDoesItDo !== undefined) {
    db.prepare('UPDATE responses SET isCorrectWhatDoesItDo = ? WHERE id = ?').run(isCorrectWhatDoesItDo, responseId);
  }
  if (isCorrectProblem !== undefined) {
    db.prepare('UPDATE responses SET isCorrectProblem = ? WHERE id = ?').run(isCorrectProblem, responseId);
  }
  if (isCorrectWhoIsFor !== undefined) {
    db.prepare('UPDATE responses SET isCorrectWhoIsFor = ? WHERE id = ?').run(isCorrectWhoIsFor, responseId);
  }
  if (isCorrectHowToUse !== undefined) {
    db.prepare('UPDATE responses SET isCorrectHowToUse = ? WHERE id = ?').run(isCorrectHowToUse, responseId);
  }
  
  res.json({ ok: true });
});

// Devpost importer endpoint - single project
app.post('/api/import/devpost', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.match(/^https?:\/\/[^/]*devpost\.com\/software\//i)) {
    return res.status(400).json({ error: 'Please provide a valid Devpost project URL' });
  }
  
  const html = await fetchUrl(url);
  const projectData = parseDevpost(html, url);
  projectData.provenanceUrl = url;
  res.json(projectData);
});

// Parse Devpost user profile to extract all project URLs
function parseDevpostProfile(html, username) {
  const projects = [];
  const $ = cheerio.load(html);

  // Get display name
  const displayName = $('#portfolio-user-name').first().text().trim() || username;

  // Get all project cards from the gallery
  $('#software-entries .gallery-item').each((_, el) => {
    const $el = $(el);
    const $link = $el.find('a[href*="/software/"]').first();
    const $title = $el.find('h5').first();
    
    if ($link.length > 0) {
      const url = $link.attr('href');
      const title = $title.text().trim() || url;
      
      if (url && !projects.some(p => p.url === url)) {
        projects.push({ url, title });
      }
    }
  });

  return {
    username: username,
    displayName: displayName,
    projects: projects
  };
}

// Devpost user profile importer - get all projects from a username
app.post('/api/import/devpost/profile', async (req, res) => {
  const { username } = req.body;
  if (!username || !username.match(/^[a-zA-Z0-9_-]+$/)) {
    return res.status(400).json({ error: 'Please provide a valid Devpost username' });
  }
  
  const profileUrl = `https://devpost.com/${username}`;
  const html = await fetchUrl(profileUrl);
  const profileData = parseDevpostProfile(html, username);
  res.json(profileData);
});

// Parse Luma event page to extract OpenGraph data
function parseLumaEvent(html, url) {
  const result = {
    title: '',
    description: '',
    imageUrl: '',
    startDate: null,
    endDate: null
  };

  const $ = cheerio.load(html);

  // Title from og:title or <title>
  result.title = ($('meta[property="og:title"]').attr('content') || $('title').text() || '').replace(/\s*·\s*Luma$/i, '').trim();

  // Description from og:description
  result.description = $('meta[property="og:description"]').attr('content') || '';

  // Image from og:image
  result.imageUrl = $('meta[property="og:image"]').attr('content') || $('meta[name="image"]').attr('content') || '';

  // Dates from JSON-LD schema
  const startDateMatch = html.match(/"startDate":"([^"]+)"/i);
  const endDateMatch = html.match(/"endDate":"([^"]+)"/i);
  if (startDateMatch) result.startDate = startDateMatch[1];
  if (endDateMatch) result.endDate = endDateMatch[1];

  return result;
}

// Add a Luma hackathon event
app.post('/api/hackathons', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.match(/^https?:\/\/[^/]*luma\.com\//i)) {
    return res.status(400).json({ error: 'Please provide a valid Luma event URL' });
  }
  
  // Check if already exists
  const existing = db.prepare('SELECT * FROM hackathons WHERE url = ?').get(url);
  if (existing) {
    return res.json(existing);
  }
  
  // Fetch and parse the Luma page
  const html = await fetchUrl(url);
  const eventData = parseLumaEvent(html, url);
  
  const result = db.prepare(`
    INSERT INTO hackathons (url, title, description, imageUrl, startDate, endDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(url, eventData.title, eventData.description, eventData.imageUrl, eventData.startDate, eventData.endDate);
  
  const hackathon = db.prepare('SELECT * FROM hackathons WHERE id = ?').get(result.lastInsertRowid);
  res.json(hackathon);
});

// Get all upcoming hackathons (future start dates)
app.get('/api/hackathons/upcoming', (req, res) => {
  const hackathons = db.prepare(`
    SELECT h.*, 
           (SELECT COUNT(*) FROM hackathon_attendees WHERE hackathonId = h.id) as attendeeCount
    FROM hackathons h
    WHERE h.startDate IS NOT NULL AND h.startDate > datetime('now')
    ORDER BY h.startDate ASC
  `).all();
  res.json(hackathons);
});

// Get all hackathons
app.get('/api/hackathons', (req, res) => {
  const hackathons = db.prepare(`
    SELECT h.*, 
           (SELECT COUNT(*) FROM hackathon_attendees WHERE hackathonId = h.id) as attendeeCount
    FROM hackathons h
    ORDER BY COALESCE(h.startDate, '9999-12-31') ASC
  `).all();
  res.json(hackathons);
});

// Mark attendance for a hackathon
app.post('/api/hackathons/:id/attend', (req, res) => {
  const hackathonId = req.params.id;
  const userId = 1; // Demo user
  
  const hackathon = db.prepare('SELECT id FROM hackathons WHERE id = ?').get(hackathonId);
  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }
  
  db.prepare(`
    INSERT OR IGNORE INTO hackathon_attendees (hackathonId, userId)
    VALUES (?, ?)
  `).run(hackathonId, userId);
  
  res.json({ ok: true });
});

// Remove attendance
app.delete('/api/hackathons/:id/attend', (req, res) => {
  const hackathonId = req.params.id;
  const userId = 1; // Demo user
  
  db.prepare('DELETE FROM hackathon_attendees WHERE hackathonId = ? AND userId = ?').run(hackathonId, userId);
  res.json({ ok: true });
});

// Add a meetup (comment/location for attendees)
app.post('/api/hackathons/:id/meetups', (req, res) => {
  const hackathonId = req.params.id;
  const userId = 1; // Demo user
  const { location, comment } = req.body;
  
  const result = db.prepare(`
    INSERT INTO hackathon_meetups (hackathonId, userId, location, comment)
    VALUES (?, ?, ?, ?)
  `).run(hackathonId, userId, location || '', comment || '');
  
  const meetup = db.prepare(`
    SELECT m.*, u.username, u.displayName, u.avatarUrl
    FROM hackathon_meetups m
    JOIN users u ON m.userId = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);
  
  res.json(meetup);
});

// Get meetups for a hackathon
app.get('/api/hackathons/:id/meetups', (req, res) => {
  const hackathonId = req.params.id;
  const meetups = db.prepare(`
    SELECT m.*, u.username, u.displayName, u.avatarUrl
    FROM hackathon_meetups m
    JOIN users u ON m.userId = u.id
    WHERE m.hackathonId = ?
    ORDER BY m.createdAt DESC
  `).all(hackathonId);
  res.json(meetups);
});

// Serve project.html for /project/:id routes
app.get('/project/:id', (req, res) => {
  res.sendFile(__dirname + '/public/project.html');
});

// Serve edit.html for /edit route
app.get('/edit', (req, res) => {
  res.sendFile(__dirname + '/public/edit.html');
});

// Serve import.html for /import route
app.get('/import', (req, res) => {
  res.sendFile(__dirname + '/public/import.html');
});

// Serve profile.html for /profile route (own profile)
app.get('/profile', (req, res) => {
  res.sendFile(__dirname + '/public/profile.html');
});

// Serve profile.html for /profile/:id route (other user's profile)
app.get('/profile/:id', (req, res) => {
  res.sendFile(__dirname + '/public/profile.html');
});

// Serve project page for /project/:id routes (including revision links like /project/1/revision/3)
app.get('/project/:id/revision/:rev', (req, res) => {
  res.sendFile(__dirname + '/public/project.html');
});

app.get('/project/:id', (req, res) => {
  res.sendFile(__dirname + '/public/project.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));