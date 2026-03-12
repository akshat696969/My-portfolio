# Financial Calculator Chrome Extension

A lightweight Chrome extension that provides multiple financial tools in a popup:

- **Loan EMI calculator**
- **SIP future value calculator**
- **Retirement corpus estimator**
- **Fixed deposit maturity estimator**
- **Lumpsum future value calculator**
- **Inflation impact calculator**
- **Currency selector (USD, EUR, INR, GBP, JPY)**
- **Sun/Moon icon toggle for light and dark mode with matching result styling**
- **50/30/20 budget split calculator**
- **Debt-to-income (DTI) ratio checker**
- **Emergency fund target estimator**
- **Savings goal planner (required monthly contribution)**

## Load locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `financial-calculator-extension` folder.

## Publish to Chrome Web Store

### 1) Prepare assets and metadata

In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), you will need:

- Extension name and short/long description
- At least one screenshot (recommended: 1280x800 or 640x400)
- A 128x128 icon
- Category and language
- Privacy disclosure details (this extension does not collect user data)

### 2) Create the upload ZIP

From the repository root:

```bash
cd /workspace/My-portfolio
zip -r financial-calculator-extension.zip financial-calculator-extension \
  -x "*/.*" "*/__MACOSX/*"
```

> Keep the ZIP root as the extension folder contents (`manifest.json`, `popup.html`, etc.).

### 3) Upload and submit

1. Go to the Developer Dashboard.
2. Click **New Item**.
3. Upload `financial-calculator-extension.zip`.
4. Fill out **Store listing** fields and upload screenshots/icon.
5. Complete **Privacy** section and declare data usage.
6. Save draft, run review checks, then click **Submit for review**.

### 4) Version updates later

- Increase `version` in `manifest.json`.
- Rebuild ZIP.
- Upload a new package in the same listing.
- Re-submit for review.

## Notes

- Values are shown in your selected currency format (USD, EUR, INR, GBP, JPY).
- Calculations are for planning only and are not financial advice.
