// Function to handle file upload
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    const reader = new FileReader();

    reader.onload = async function (e) {
        const data = e.target.result;

        try {
            let questions;
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                questions = await handleExcelFile(data);
            } else if (file.name.endsWith('.pdf')) {
                questions = await handlePdfFile(data);
            } else if (file.name.endsWith('.docx')) {
                questions = await handleDocxFile(data);
            } else {
                alert('Unsupported file format. Please upload a valid Excel, PDF, or Word file.');
                return;
            }

            // Convert to JSON and send to the server
            sendToServer(questions);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('There was an error processing the file. Please try again.');
        }
    };

    reader.readAsArrayBuffer(file);
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
function sendToServer(questions) {
    fetch('/add-questions-from-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ questions })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            // Optionally refresh the question list or perform other UI updates
        })
        .catch(error => console.error('Error:', error));
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

// Fetch and display answers initially
fetchAnswers();
setInterval(fetchAnswers, 5000); // Update answers every 5 seconds
