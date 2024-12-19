let studentName = '';
let answers = [];

document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    studentName = document.getElementById('studentName').value;
    document.getElementById('studentForm').style.display = 'none';
    document.getElementById('quiz').style.display = 'block';
    loadQuestions();
});

async function loadQuestions() {
    const response = await fetch('/get-questions');
    const questions = await response.json();
    const questionsContainer = document.getElementById('questions');

    questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.innerHTML = `
            <p>${index + 1}. ${question.question}</p>
            ${question.options.map((option, i) => `
                <label>
                    <input type="radio" name="question${index}" value="${i}">
                    ${option}
                </label>
            `).join('')}
        `;
        questionsContainer.appendChild(questionDiv);
    });

    document.getElementById('submitQuiz').addEventListener('click', submitAnswers);
}

async function submitAnswers() {
    const inputs = document.querySelectorAll('input[type="radio"]:checked');
    answers = Array.from(inputs).map(input => parseInt(input.value));
    const response = await fetch('/submit-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: studentName, answers }),
    });
    const result = await response.json();
    alert(`שאלון הוגש! תשובות נכונות: ${result.correctAnswers}/${result.totalQuestions}`);
    location.reload();
}
