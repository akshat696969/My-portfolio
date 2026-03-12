const calculatorType = document.getElementById('calculatorType');
const form = document.getElementById('calculatorForm');
const resultText = document.getElementById('resultText');
const fieldGroups = document.querySelectorAll('.field-group');

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

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

  resultText.textContent = 'Enter values and click Calculate.';
};

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

const getNumber = (id) => Number.parseFloat(document.getElementById(id).value || '0');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const selected = calculatorType.value;

  if (selected === 'emi') {
    const principal = getNumber('principal');
    const annualRate = getNumber('annualRate');
    const years = getNumber('loanYears');

    const emi = calculateEmi({ principal, annualRate, years });
    const totalPayment = emi * years * 12;

    resultText.textContent = `Monthly EMI: ${formatCurrency(emi)} | Total Payment: ${formatCurrency(totalPayment)}`;
    return;
  }

  if (selected === 'sip') {
    const monthlyInvestment = getNumber('principal');
    const annualRate = getNumber('sipRate');
    const years = getNumber('sipYears');

    const futureValue = calculateSipFutureValue({ monthlyInvestment, annualRate, years });
    const investedAmount = monthlyInvestment * years * 12;

    resultText.textContent = `Future Value: ${formatCurrency(futureValue)} | Total Invested: ${formatCurrency(investedAmount)}`;
    return;
  }

  const currentAmount = getNumber('principal');
  const annualRate = getNumber('annualRate');
  const years = getNumber('retirementYears');
  const corpus = calculateRetirementCorpus({ currentAmount, annualRate, years });

  resultText.textContent = `Estimated Corpus: ${formatCurrency(corpus)} after ${years} years.`;
});

calculatorType.addEventListener('change', showFieldsForCalculator);
showFieldsForCalculator();
