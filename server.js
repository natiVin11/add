import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import open from 'open';

const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// Adjust paths using path.resolve to handle ES module and __dirname issues
const QUESTIONS_FILE = path.resolve('questions.json');
const RESULTS_FILE = path.resolve('results.json');

// Function to read data from JSON file
function readJSONFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return []; // If the file does not exist or is empty
    }
}

// Function to write data to a JSON file
function writeJSONFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Read questions and answers from JSON files
let questions = readJSONFile(QUESTIONS_FILE);
let results = readJSONFile(RESULTS_FILE);

// Route to get questions
app.get('/get-questions', (req, res) => {
    res.json(questions);
});

// Route to add a new question
app.post('/add-question', (req, res) => {
    const { question, options, correct } = req.body;
    if (!question || !options || correct === undefined || options.length !== 3 || correct < 0 || correct > 2) {
        return res.status(400).json({ message: 'Invalid data' });
    }
    questions.push({ question, options, correct });
    writeJSONFile(QUESTIONS_FILE, questions); // Save to JSON
    res.json({ message: 'Question added successfully' });
});

// Route to submit student answers
app.post('/submit-answers', (req, res) => {
    const { name, answers } = req.body;
    if (!name || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: 'Invalid data' });
    }
    const correctAnswers = answers.filter((answer, index) => answer === questions[index]?.correct).length;
    const result = { name, answers, score: correctAnswers };
    results.push(result);
    writeJSONFile(RESULTS_FILE, results); // Save to JSON
    res.json({ correctAnswers, totalQuestions: questions.length });
});

// Route to get student answers
app.get('/get-answers', (req, res) => {
    res.json(
        results.map((result) => ({
            name: result.name,
            answers: result.answers.map((ans, i) => questions[i]?.options[ans] || 'Not answered'),
            score: result.score,
        }))
    );
});

// Function to fetch student answers and update scores
function fetchAnswers() {
    results = readJSONFile(RESULTS_FILE);
    console.log('Student answers and scores fetched:', results);
}

// Route to handle file upload
app.post('/upload', (req, res) => {
    uploadFile(req, res);
});

// Function to handle file upload
async function uploadFile(req, res) {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        let questionsData;
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            questionsData = await handleExcelFile(file.buffer);
        } else if (file.mimetype === 'application/pdf') {
            questionsData = await handlePdfFile(file.buffer);
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            questionsData = await handleDocxFile(file.buffer);
        } else {
            return res.status(400).json({ message: 'Unsupported file format. Please upload a valid Excel, PDF, or Word file.' });
        }

        // Convert to JSON and send to the server
        sendToServer(questionsData, res);
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: 'There was an error processing the file. Please try again.' });
    }
}

// Function to handle Excel files
async function handleExcelFile(data) {
    const XLSX = require('xlsx'); // Ensure to install xlsx via npm
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
}

// Function to handle PDF files
async function handlePdfFile(data) {
    const PDFDocument = require('pdf-lib').PDFDocument; // Ensure to install pdf-lib via npm
    const pdfDoc = await PDFDocument.load(data);
    const pages = await pdfDoc.getPage(0).getTextContent();
    const text = pages.items.map(item => item.str).join(' ');
    return parseTextToQuestions(text); // Implement a function to parse text
}

// Function to handle Word files
async function handleDocxFile(data) {
    const docx = require('docx'); // Ensure to install docx via npm
    const buffer = Buffer.from(data);
    const doc = new docx.Document(buffer);
    return parseDocToQuestions(doc); // Implement a function to parse DOCX
}

// Function to convert questions to JSON and send to server
function sendToServer(questions, res) {
    fetch('/add-questions-from-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ questions })
    })
        .then(response => response.json())
        .then(data => {
            res.json({ message: data.message });
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).json({ message: 'There was an error sending the questions to the server. Please try again.' });
        });
}

// Function to parse text from PDF
function parseTextToQuestions(text) {
    // Example: Split the text into questions and answers (you need to implement this)
    const lines = text.split('\n');
    const questions = [];
    for (let line of lines) {
        if (line.trim() === '') continue; // Skip empty lines
        const [question, ...options] = line.split(';'); // Assuming the format is question;option1;option2;option3;correct
        questions.push({
            question: question.trim(),
            options: options.slice(0, 3).map(opt => opt.trim()),
            correct: parseInt(options[3].trim())
        });
    }
    return questions;
}

// Function to parse DOCX to questions
function parseDocToQuestions(doc) {
    const paragraphs = doc.body.getChildren();
    const questions = [];
    paragraphs.forEach(paragraph => {
        const lines = paragraph.text.split('\n');
        lines.forEach(line => {
            if (line.trim() === '') return; // Skip empty lines
            const [question, ...options] = line.split(';'); // Assuming the format is question;option1;option2;option3;correct
            questions.push({
                question: question.trim(),
                options: options.slice(0, 3).map(opt => opt.trim()),
                correct: parseInt(options[3].trim())
            });
        });
    });
    return questions;
}

// Start the server
const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await open(`http://localhost:${PORT}`); // Open index.html in browser using ES Module import
});
