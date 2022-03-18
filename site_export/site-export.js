/**
 * @author Mark Snyder
 * @copyright Copyright 2021-2022 Utah State University
 */

let api, fileBrowser, gadgetModal;

let filterPath, lastFilterPath, currentMode, lastMode, http_root; // ''
let records, output; // []
let excludeResources; // bool

const REGEX_FILE_TYPE = /\.[A-z0-9]*?$/;
const REGEX_NO_PCF = /(.*)\.pcf/;

$(() => {

  gadget.ready().then(gadget.fetch).then(() => {

    init();

    document.querySelector('#loading').style.display = 'none';
    document.querySelector('#main').style.display = 'block';
    document.querySelector('#gadget-toolbar-container').style.display = 'block';
  });
});

/**
 * Runs on gadget load.
 */
function init() {

  records = [];
  currentMode = 'pages';
  filterPath = '';

  gadgetModal = new GadgetModal();

  api = new OmniAPI({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'site_export',
  });

  fileBrowser = new OmniFileBrowser({
    api: api,
    callback: fileBrowserHandler,
    includePages: false,
    includeBinaries: false,
  });

  document.querySelector('#input-filepath').addEventListener('focus', () => {
    toggleSidePanel('file-browser', 'right');
    this.blur();
  });

  for (let element of document.querySelectorAll('.update-params')) {
    element.addEventListener('click', updateParams);
  }
}

function updateParams() {
  document.querySelector('#csv-export-btn').disabled = true;
  document.querySelector('#csv-export-btn').title = 'Parameters have been updated, resubmit before updating.';
  excludeResources = document.querySelector('#checkbox-exclude-resources').checked;
  if (document.querySelector('#checkbox-assets').checked) {
    currentMode = 'assets';
    document.querySelector('#checkbox-exclude-resources').checked = false;
    document.querySelector('#checkbox-exclude-resources').disabled = true;
  } else {
    currentMode = 'pages';
    document.querySelector('#checkbox-exclude-resources').disabled = false;
  }
}

/**
 * Handler function for the file browser.
 * @param {String} path The directory path from the file browser.
 */
function fileBrowserHandler(path) {
  filterPath = path;
  document.querySelector('#input-filepath').value = filterPath;
  updateParams();
}

/**
 * Main function for the gadget that runs when it is submitted.
 */
function run() {
  document.querySelector('#run').disabled = true;
  document.querySelector('#run').innerHTML = `
  <span>Loading... </span>
  <div id="spinner" class="spinner-border spinner-border-sm spinner-grow-sm" role="status">
    <span class="sr-only">Loading...</span>
  </div>
  `;

  let proms = [];

  if (!http_root) {
    proms.push(api.sites_view().then(r => {
      http_root = r.http_root.slice(0, -1);
    }));
  }

  if (records.length === 0 || filterPath !== lastFilterPath || currentMode !== lastMode) {
    lastFilterPath = filterPath;
    lastMode = currentMode;

    let report = {
      all: true,
    };

    if (currentMode === 'pages') {
      report.report = 'products';
      report.pd_access = 'on';
      report.pd_address = 'on';
      report.pd_subscribers = 'on';
      report.pd_access = 'on';
      report.pd_address_str = filterPath;
    } else if (currentMode === 'assets') {
      report.report = 'assets';
      report.a_dtag = 'on';
      report.a_name = 'on';
      report.a_type = 'on';
      report.a_subscribers = 'on';
    }

    proms.push(api.custom_report(report).then(r => {
      records = r.records;
    }));
  }

  Promise.all(proms).then(buildOutput);
}

/**
 * Takes the data received from the reports endpoint processes it depending on the user input.
 */
function buildOutput() {
  output = [];
  let proms = [];

  if (currentMode === 'pages') proms.push(buildOutputPages());
  else if (currentMode === 'assets') proms.push(buildOutputAssets());

  Promise.all(proms).then(() => {

    buildCSV({
      array: output,
      filename: 'site_export',
      includeDate: true,
    });

    document.querySelector('#run').innerText = 'Submit';
    document.querySelector('#run').disabled = false;
    document.querySelector('#csv-export-btn').disabled = false;
    document.querySelector('#csv-export-btn').title = '';
    document.querySelector('#csv-export').click();
  });
}

/**
 * Prepares the output array when searching for pages.
 * @returns {Promise<void>}
 */
function buildOutputPages() {

  if (!document.querySelector('#checkbox-exclude-headers').checked) output.push([
    'File Path',
    'OU Campus Address',
    'Production Address',
    'Access Group',
    'File Type',
    'Subscriber Count',
  ]);

  let prev = '';

  records = sortObjs(records, 'pd_address');

  for (let entry of records) {

    if (entry.pd_address === prev) continue;
    if (excludeResources && entry.pd_address.includes('_resources')) continue;

    prev = entry.pd_address;

    output.push([
      entry.pd_address,
      OUPath(entry.pd_address),
      getFileType(entry.pd_address) === '.pcf' ? http_root + entry.pd_address.match(REGEX_NO_PCF)[1] : http_root + entry.pd_address,
      entry.pd_access,
      getFileType(entry.pd_address),
      entry.pd_subscribers,
    ]);
  }

  return Promise.resolve();
}

/**
 * Prepares the output array when searching for assets.
 * @returns {Promise<unknown[]>}
 */
function buildOutputAssets() {

  if (!document.querySelector('#checkbox-exclude-headers').checked) output.push([
    'Asset Name',
    'D Tag',
    'Asset Type',
    '# of Subscribers',
    'Subscribers',
  ]);

  let proms = [];
  let fin = [];

  for (let [i, entry] of records.entries()) {

    entry.a_subscribers = parseInt(entry.a_subscribers);

    if (entry.a_subscribers > 0) {

      proms.push(api.files_subscribers({
        tag: entry.a_dtag,
      }).then(r => {

        let arr = [];

        for (let page of r.subscribers.pages) {
          if (!page.path.includes(filterPath)) {
            continue;
          }

          arr.push(OUPath(page.path, false, page.sitename));
        }

        entry.subs = arr;

        if (filterPath === '' || filterPath === '/' || entry.subs.length > 0) fin.push(entry);
      }));
    } else if (filterPath === '' || filterPath === '/') fin.push(entry);

  }

  return Promise.all(proms).then(() => {

    fin = sortObjs(fin, 'a_name');

    for (let entry of fin) {

      output.push([
        entry.a_name,
        entry.a_dtag,
        entry.a_type,
        entry.subs ? entry.subs.length : 0,
        entry.subs ? entry.subs : '',
      ]);
    }
  });
}

/**
 * Sorts the 2D output array by the first element.
 * @param a Element to compare
 * @param b Element to compare
 * @returns {number}
 */
function sortFunc(a, b) {
  return (a[0].toUpperCase() < b[0].toUpperCase()) ? -1 : 1;
}

/**
 * Gets the file type of a given file path.
 * @param {String} file The file path to check
 * @returns {*}
 */
function getFileType(file) {
  try {
    return file.match(REGEX_FILE_TYPE)[0];
  } catch (e) {
    console.log('%cREGEX ERROR', 'color: red', file, e);
  }
}