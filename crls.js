require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = 4000;

app.use(express.static('publiccrl'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// === MONGODB SCHEMA ===
const LetterSchema = new mongoose.Schema({
  ndaNumber: String,
  applicationName: String,
  company: {
    name: String,
    contact: String,
    address: String
  },
  letterType: String,
  date: String,
  clinicalFindings: [String],
  studiesReferenced: [String],
  fdaOffice: String,
  fdaContact: String,
  signature: String,
  summary: String,
  rawText: String,
  aiSummary: String,
  aiAnalysis: String,
  aiIndex: [String]
});
const Letter = mongoose.model('Letter', LetterSchema);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Mongo error:', err));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === LETTER SPLITTING ===
async function extractLettersFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const rawText = data.text;

  const cleaned = rawText.replace(/CENTER FOR DRUG.*?OTHER ACTION LETTERS/i, '').trim();
  const letterBlocks = cleaned.split(/\n(?=NDA\s\d{6}\s+COMPLETE RESPONSE)/g);
  return letterBlocks
    .map(block => block.trim())
    .filter(block => block.length > 500);
}

// === CHUNKED STRUCTURED EXTRACTION ===
async function extractStructuredLetter(rawText) {
  const MAX_CHARS = 12000;
  const chunks = [];

  if (rawText.length > MAX_CHARS) {
    const paragraphs = rawText.split(/\n\s*\n/);
    let currentChunk = "";

    for (const p of paragraphs) {
      if ((currentChunk + p).length > MAX_CHARS) {
        chunks.push(currentChunk);
        currentChunk = p + "\n\n";
      } else {
        currentChunk += p + "\n\n";
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  } else {
    chunks.push(rawText);
  }

  const partialSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `This is part ${i + 1} of an FDA letter. Summarize this content in detail as plain text.\n\n"""${chunks[i]}"""`
      }],
      temperature: 0.2
    });

    partialSummaries.push(response.choices[0].message.content.trim());
  }

  const mergedSummary = partialSummaries.join("\n\n");

  const finalPrompt = `
Based on the following full FDA letter summary, return a single valid JSON object with:
- ndaNumber
- applicationName
- company: { name, contact, address }
- letterType
- date
- clinicalFindings (bullet list)
- studiesReferenced (list)
- fdaOffice
- fdaContact
- signature
- summary (brief)
- rawText

"""${mergedSummary}"""
  `;

  const finalResponse = await openai.chat.completions.create({
     model: 'gpt-3.5-turbo-1106',
    messages: [{ role: 'user', content: finalPrompt }],
    temperature: 0
  });

  const content = finalResponse.choices[0].message.content.trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch (err) {
    console.error('❌ Final structured parsing failed:', err);
    return null;
  }
}

// === ENRICH WITH AI SUMMARY, ANALYSIS & INDEXING ===
async function enrichLetterWithAI(structuredLetter) {
  const prompt = `
From this FDA letter, return the following JSON:
- aiSummary: Short contextual summary of the issue
- aiAnalysis: Deeper analysis of the regulatory implications
- aiIndex: Array of keywords (company, product, issue, drug, condition, etc.)

"""${structuredLetter.rawText}"""
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  const content = response.choices[0].message.content.trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch (e) {
    console.error('❌ AI enrichment failed:', e);
    return { aiSummary: '', aiAnalysis: '', aiIndex: [] };
  }
}

// === MULTI FILE UPLOAD ===
app.post('/upload', upload.array('files'), async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    const files = req.files;
    let letterTexts = [];

    for (const file of files) {
      const letters = await extractLettersFromPdf(file.path);
      letterTexts.push(...letters);
      fs.unlinkSync(file.path);
    }

    res.write(`<style>body { font-family: monospace; white-space: pre-wrap; }</style>`);
    res.write(`📦 ${files.length} PDF files uploaded\n`);
    res.write(`📄 Found ${letterTexts.length} total letters\n\n`);

    let savedCount = 0;

    for (let i = 0; i < letterTexts.length; i++) {
      res.write(`➡️ Parsing letter ${i + 1}...\n`);
      const structured = await extractStructuredLetter(letterTexts[i]);

      if (!structured) {
        res.write(`❌ Could not parse letter ${i + 1}\n\n`);
        continue;
      }

      const aiEnriched = await enrichLetterWithAI(structured);
      const fullLetter = { ...structured, ...aiEnriched };

      await Letter.create(fullLetter);
      savedCount++;

      for (const char of fullLetter.aiSummary || 'Done') {
        res.write(char);
        await new Promise(r => setTimeout(r, 8));
      }
      res.write('\n\n✅ Saved.\n\n');
    }

    res.write(`🎉 All done. Saved ${savedCount} letters.`);
    res.end();
  } catch (err) {
    console.error('❌ Error during upload:', err);
    res.end('❌ Upload failed');
  }
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
