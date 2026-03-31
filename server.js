require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const Database = require('better-sqlite3');
const https = require('https');
const http = require('http');

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
    isCorrect INTEGER DEFAULT NULL, -- NULL = not yet rated, 0 = incorrect, 1 = correct
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (revisionId) REFERENCES revisions(id),
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
    githubUrl: '', 
    websiteUrl: '', 
    videoUrl: '' 
  };
  
  // Title
  const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || 
                     html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();
  
  // Short description from p class="large"
  const shortDescMatch = html.match(/<p[^>]*class="[^"]*large[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  result.description = shortDescMatch ? shortDescMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  
  // Story from #app-details-left
  const appDetailsMatch = html.match(/<article[^>]*id="app-details"[\s\S]*?<\/article>/i);
  if (appDetailsMatch) {
    const firstPMatch = appDetailsMatch[0].match(/<div>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
    if (firstPMatch) {
      result.story = firstPMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  
  // Extract YouTube video from embed tag (iframe) - this is the embedded player
  const youtubeEmbedMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
  if (youtubeEmbedMatch) {
    result.videoUrl = `https://youtube.com/watch?v=${youtubeEmbedMatch[1]}`;
  }
  
  // Extract GitHub URL - look in the "Try it out" section
  const tryItOutSection = html.match(/<h2[^>]*>\s*Try it out[\s\S]*?<\/h2>([\s\S]*?)<\/nav>/i);
  if (tryItOutSection) {
    const githubMatch = tryItOutSection[1].match(/href="(https?:\/\/github\.com\/[^"]+)"/i);
    if (githubMatch) result.githubUrl = githubMatch[1];
  }
  // Fallback: any github.com link in the page
  if (!result.githubUrl) {
    const githubMatch = html.match(/href="(https?:\/\/github\.com\/[^"]+)"/i);
    if (githubMatch) result.githubUrl = githubMatch[1];
  }
  
  // Extract website URL from "Try it out" section (not devpost itself)
  if (tryItOutSection) {
    const websiteMatch = tryItOutSection[1].match(/href="(https?:\/\/(?!devpost\.com)[^"]+)"/i);
    if (websiteMatch) result.websiteUrl = websiteMatch[1];
  }
  
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

// Get all projects for user (with latest revision info)
app.get('/api/projects', (req, res) => {
  const userId = 1; // Demo user
  const projects = db.prepare(`
    SELECT p.*, 
           r.description as latestDescription,
           r.story as latestStory,
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
    SELECT r.*, 
           (SELECT COUNT(*) FROM responses WHERE revisionId = r.id) as responseCount
    FROM revisions r
    WHERE r.projectId = ?
    ORDER BY r.revisionNumber DESC
  `).all(projectId);
  
  // Get responses for each revision
  for (const rev of revisions) {
    rev.responses = db.prepare(`
      SELECT resp.*, u.username, u.displayName
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
app.post('/api/projects', (req, res) => {
  const userId = 1; // Demo user
  const { title, description, story, videoUrl, githubUrl, websiteUrl, provenanceUrl } = req.body;
  
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
      
      db.prepare(`
        INSERT INTO revisions (projectId, revisionNumber, description, story, videoUrl, githubUrl, websiteUrl)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, newRevNum, description, story || '', videoUrl || '', githubUrl || '', websiteUrl || '');
      
      return res.json({ id: projectId, revisionNumber: newRevNum, isNewRevision: true });
    }
  }
  
  // Create new project
  const result = db.prepare(
    'INSERT INTO projects (userId, title, provenanceUrl) VALUES (?, ?, ?)'
  ).run(userId, title, provenanceUrl || '');
  
  projectId = result.lastInsertRowid;
  
  // Create first revision
  db.prepare(`
    INSERT INTO revisions (projectId, revisionNumber, description, story, videoUrl, githubUrl, websiteUrl)
    VALUES (?, 1, ?, ?, ?, ?, ?)
  `).run(projectId, description, story || '', videoUrl || '', githubUrl || '', websiteUrl || '');
  
  res.json({ id: projectId, revisionNumber: 1, isNewProject: true });
});

// Add a new revision to an existing project
app.post('/api/projects/:id/revisions', (req, res) => {
  const projectId = req.params.id;
  const { description, story, videoUrl, githubUrl, websiteUrl } = req.body;
  
  if (!description || description.length > 2000) {
    return res.status(400).json({ error: 'Description is required (max 2000 chars)' });
  }
  
  const maxRev = db.prepare(
    'SELECT MAX(revisionNumber) as max FROM revisions WHERE projectId = ?'
  ).get(projectId);
  
  const newRevNum = (maxRev.max || 0) + 1;
  
  db.prepare(`
    INSERT INTO revisions (projectId, revisionNumber, description, story, videoUrl, githubUrl, websiteUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, newRevNum, description, story || '', videoUrl || '', githubUrl || '', websiteUrl || '');
  
  res.json({ revisionNumber: newRevNum });
});

// Submit a response (audience answers the 4 decoding questions)
app.post('/api/revisions/:id/responses', (req, res) => {
  const revisionId = req.params.id;
  const userId = 1; // Demo user
  const { whatDoesItDo, problemItSolves, whoIsItFor, howToUse } = req.body;
  
  if (!whatDoesItDo || !problemItSolves || !whoIsItFor || !howToUse) {
    return res.status(400).json({ error: 'All 4 questions must be answered' });
  }
  
  const result = db.prepare(`
    INSERT INTO responses (revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(revisionId, userId, whatDoesItDo, problemItSolves, whoIsItFor, howToUse);
  
  res.json({ id: result.lastInsertRowid });
});

// Rate a response (hacker marks it correct or incorrect)
app.patch('/api/responses/:id/rate', (req, res) => {
  const responseId = req.params.id;
  const { isCorrect } = req.body;
  
  if (typeof isCorrect !== 'number' || (isCorrect !== 0 && isCorrect !== 1)) {
    return res.status(400).json({ error: 'isCorrect must be 0 (incorrect) or 1 (correct)' });
  }
  
  db.prepare('UPDATE responses SET isCorrect = ? WHERE id = ?').run(isCorrect, responseId);
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
  
  const gallerySectionMatch = html.match(/<div id="software-entries"[^>]*>([\s\S]*?)<div class="pagination-centered"/i);
  const galleryHtml = gallerySectionMatch ? gallerySectionMatch[1] : '';
  
  const galleryItemRegex = /<div class="(?:large-\d+\s+)?small-12\s+columns\s+gallery-item"[^>]*>[\s\S]*?href="(https?:\/\/[^/]*devpost\.com\/software\/([^"]+))">[\s\S]*?<h5>\s*([^<]+)\s*<\/h5>/gi;
  let match;
  const seenUrls = new Set();
  
  while ((match = galleryItemRegex.exec(galleryHtml)) !== null) {
    const url = match[1];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      projects.push({ 
        url: url,
        title: match[3].trim()
      });
    }
  }
  
  const displayNameMatch = html.match(/id="portfolio-user-name"[^>]*>([^<]+)/i);
  
  return {
    username: username,
    displayName: displayNameMatch ? displayNameMatch[1].trim() : username,
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

// Serve project.html for /project/:id routes
app.get('/project/:id', (req, res) => {
  res.sendFile(__dirname + '/public/project.html');
});

// Serve edit.html for /edit route
app.get('/edit', (req, res) => {
  res.sendFile(__dirname + '/public/edit.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));