const PRINT_JOB_KEY = "pendingPrintJob";

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(result ? result[key] : undefined);
    });
  });
}

function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function waitForImages() {
  const images = Array.from(document.images);
  await Promise.all(images.map((img) => new Promise((resolve) => {
    if (img.complete) {
      resolve();
      return;
    }
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  })));
}

function renderTable(job) {
  const headRow = document.getElementById("tableHeadRow");
  const body = document.getElementById("tableBody");
  const shell = document.getElementById("pageShell");
  const status = document.getElementById("status");
  const generatedAt = document.getElementById("generatedAt");
  const headerBrand = document.getElementById("headerBrand");
  const brandLogo = document.getElementById("brandLogo");
  const footer = document.getElementById("footer");

  const includeTags = Boolean(job.includeTags);
  const branded = Boolean(job.branded);

  generatedAt.textContent = `Generated on ${job.generatedAt}`;
  headerBrand.style.display = branded ? "flex" : "none";
  footer.style.display = branded ? "block" : "none";
  if (branded && job.logoUrl) {
    brandLogo.src = job.logoUrl;
  }

  const headers = ["Content", "Timestamp", "Source", "Source Link"];
  if (includeTags) {
    headers.push("Tags");
    document.documentElement.style.setProperty("--content-col", "38%");
    document.documentElement.style.setProperty("--time-col", "16%");
    document.documentElement.style.setProperty("--link-col", "20%");
  } else {
    document.documentElement.style.setProperty("--content-col", "44%");
    document.documentElement.style.setProperty("--time-col", "18%");
    document.documentElement.style.setProperty("--link-col", "26%");
  }

  headRow.innerHTML = headers
    .map((header, index) => {
      const cls = index === 0
        ? "col-content"
        : index === 1
          ? "col-time"
          : index === 2
            ? "col-source"
            : index === 3
              ? "col-link"
              : "col-tags";
      return `<th class="${cls}">${escapeHtml(header)}</th>`;
    })
    .join("");

  body.innerHTML = job.rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.text)}</td>
        <td>${escapeHtml(row.createdAt)}</td>
        <td>${escapeHtml(row.source)}</td>
        <td>${escapeHtml(row.url)}</td>
        ${includeTags ? `<td>${escapeHtml(row.tags)}</td>` : ""}
      </tr>
    `)
    .join("");

  status.hidden = true;
  shell.hidden = false;
}

async function init() {
  let job = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    job = await getStorage(PRINT_JOB_KEY);
    if (job && job.type === "pdf") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!job || job.type !== "pdf") {
    document.getElementById("status").textContent = "No print job found.";
    return;
  }

  renderTable(job);
  await waitForImages();
  await setStorage({ [PRINT_JOB_KEY]: null });

  setTimeout(() => {
    window.focus();
    window.print();
  }, 120);
}

init().catch((error) => {
  document.getElementById("status").textContent = `Print error: ${error.message}`;
});
