const calculatorType = document.getElementById('calculatorType');
const currencyType = document.getElementById('currencyType');
const themeToggle = document.getElementById('themeToggle');
const form = document.getElementById('calculatorForm');
const resultText = document.getElementById('resultText');
const fieldGroups = document.querySelectorAll('.field-group');

const currencyLocaleMap = {
  USD: 'en-US',
  EUR: 'de-DE',
  INR: 'en-IN',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

const formatCurrency = (value) => {
  const currency = currencyType.value;
  const locale = currencyLocaleMap[currency] || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
};

const renderResult = (lines, finalLine) => {
  const normalLines = lines.map((line) => `<p class="result-line">${line}</p>`).join('');
  const final = finalLine ? `<p class="result-line result-line--final">${finalLine}</p>` : '';
  resultText.innerHTML = `${normalLines}${final}`;
};

const applyTheme = (theme) => {
  document.body.dataset.theme = theme;
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  themeToggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
};

const toggleTheme = () => {
  const currentTheme = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
};

const showFieldsForCalculator = () => {
  const selected = calculatorType.value;

  fieldGroups.forEach((group) => {
    const calculators = group.dataset.calc.split(' ');
    const shouldShow = calculators.includes(selected);

    group.classList.toggle('hidden', !shouldShow);

    const input = group.querySelector('input');
    input.required = shouldShow;
    if (!shouldShow) {
      input.value = '';
    }
  });

  renderResult(['Enter values and click Calculate.']);
};

const getNumber = (id) => Number.parseFloat(document.getElementById(id).value || '0');

const calculateEmi = ({ principal, annualRate, years }) => {
  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;
  if (monthlyRate === 0) {
    return principal / months;
  }
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
};

const calculateSipFutureValue = ({ monthlyInvestment, annualRate, years }) => {
  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;
  if (monthlyRate === 0) {
    return monthlyInvestment * months;
  }
  return (
    monthlyInvestment *
    ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
    (1 + monthlyRate)
  );
};

const calculateRetirementCorpus = ({ currentAmount, annualRate, years }) =>
  currentAmount * Math.pow(1 + annualRate / 100, years);

const calculateFutureValueLumpsum = ({ amount, annualRate, years }) =>
  amount * Math.pow(1 + annualRate / 100, years);

const calculateInflationAdjustedValue = ({ amount, inflationRate, years }) =>
  amount / Math.pow(1 + inflationRate / 100, years);

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const selected = calculatorType.value;

  if (selected === 'emi') {
    const principal = getNumber('principal');
    const annualRate = getNumber('annualRate');
    const years = getNumber('loanYears');
    const emi = calculateEmi({ principal, annualRate, years });
    const totalPayment = emi * years * 12;

    renderResult(
      [
        `Loan amount: ${formatCurrency(principal)}`,
        `Loan term: ${years} years @ ${annualRate}% annual rate`,
        `Monthly EMI: ${formatCurrency(emi)}`,
      ],
      `Total Payment: ${formatCurrency(totalPayment)}`
    );
    return;
  }

  if (selected === 'sip') {
    const monthlyInvestment = getNumber('principal');
    const annualRate = getNumber('sipRate');
    const years = getNumber('sipYears');
    const futureValue = calculateSipFutureValue({ monthlyInvestment, annualRate, years });
    const investedAmount = monthlyInvestment * years * 12;

    renderResult(
      [
        `Monthly investment: ${formatCurrency(monthlyInvestment)}`,
        `Duration: ${years} years @ ${annualRate}% expected annual return`,
        `Future Value: ${formatCurrency(futureValue)}`,
      ],
      `Total Invested: ${formatCurrency(investedAmount)}`
    );
    return;
  }

  if (selected === 'retirement') {
    const currentAmount = getNumber('principal');
    const annualRate = getNumber('annualRate');
    const years = getNumber('years');
    const corpus = calculateRetirementCorpus({ currentAmount, annualRate, years });

    renderResult(
      [
        `Current amount: ${formatCurrency(currentAmount)}`,
        `Growth period: ${years} years @ ${annualRate}%`,
      ],
      `Estimated Corpus: ${formatCurrency(corpus)}`
    );
    return;
  }

  if (selected === 'fd') {
    const amount = getNumber('principal');
    const annualRate = getNumber('annualRate');
    const years = getNumber('years');
    const maturityAmount = calculateFutureValueLumpsum({ amount, annualRate, years });
    const interestEarned = maturityAmount - amount;

    renderResult(
      [
        `Principal: ${formatCurrency(amount)}`,
        `Duration: ${years} years @ ${annualRate}%`,
        `Interest Earned: ${formatCurrency(interestEarned)}`,
      ],
      `FD Maturity: ${formatCurrency(maturityAmount)}`
    );
    return;
  }

  if (selected === 'lumpsum') {
    const amount = getNumber('principal');
    const annualRate = getNumber('annualRate');
    const years = getNumber('years');
    const futureValue = calculateFutureValueLumpsum({ amount, annualRate, years });

    renderResult(
      [
        `One-time investment: ${formatCurrency(amount)}`,
        `Duration: ${years} years @ ${annualRate}%`,
      ],
      `Future Value: ${formatCurrency(futureValue)}`
    );
    return;
  }

  const amount = getNumber('principal');
  const inflationRate = getNumber('annualRate');
  const years = getNumber('years');
  const inflationAdjustedValue = calculateInflationAdjustedValue({ amount, inflationRate, years });

  renderResult(
    [
      `Future amount target: ${formatCurrency(amount)}`,
      `Inflation assumption: ${inflationRate}% for ${years} years`,
    ],
    `Today's Value: ${formatCurrency(inflationAdjustedValue)}`
  );
});

calculatorType.addEventListener('change', showFieldsForCalculator);
currencyType.addEventListener('change', () => {
  const existing = resultText.querySelector('.result-line--final');
  if (existing) {
    form.requestSubmit();
    return;
  }
  renderResult(['Currency updated. Enter values and click Calculate.']);
});
themeToggle.addEventListener('click', toggleTheme);

applyTheme('light');
showFieldsForCalculator();
