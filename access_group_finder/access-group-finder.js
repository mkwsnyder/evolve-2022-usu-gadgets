/**
 * @author Mark Snyder
 * @copyright Copyright 2021-2022 Utah State University
 */

let api, gadgetModal, userList;

const MAX_STACK = 5;

let groups, selectedSites, emptySites; // []
let currentGroup; // ''
let currentDirectoryIndex, currentFileIndex, finishedDirectoryCount,
  finishedFileCount; // int
let includeFolders, includeFiles; // bool
let final; // {}

$(() => {

  gadget.ready().then(gadget.fetch).then(() => {

    init().then(() => {

      document.querySelector('#loading').style.display = 'none';
      document.querySelector('#main').style.display = 'block';
      document.querySelector('#gadget-toolbar-container').style.display = 'block';

    });
  });
});

/**
 * Runs on gadget load.
 */
function init() {
  gadgetModal = new GadgetModal();

  api = new OMNI_API({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'access_group_finder',
  });

  userList = new OU_UserList({api: api});

  updateParams();
  for (let element of document.querySelectorAll('.update-params')) {
    element.addEventListener('click', updateParams);
  }

  let proms = [];

  proms.push(api.custom_report({
    report: 'groups',
    count: 100000,
    g_memberlist: 'on',
  }).then(r => {

    groups = {};

    for (let e of r.records) {
      groups[e.g_name] = e.g_memberlist.split(', ');

      let opt = document.createElement('option');
      opt.innerText = `${e.g_name} (${groups[e.g_name].length})`;
      opt.value = e.g_name;
      document.querySelector('#select-group').appendChild(opt);
    }
  }));

  proms.push(api.sites_list().then(r => {

    for (let e of sortObjs(r, 'site')) {
      let opt = document.createElement('option');
      opt.value = opt.innerText = e.site;
      if (e.site === gadget.site) opt.selected = true;
      document.querySelector('#select-sites').appendChild(opt);
    }
  }));

  return Promise.all(proms).then(() => {

    tail.select('#select-group', {
      animate: false,
      multiple: false,
      multiPinSelected: true,
      multiSelectAll: false,
      placeholder: 'Access Group',
      search: true,
      searchDisabled: false,
      searchFocus: true,
      stayOpen: false,
    });

    tail.select('#select-sites', {
      animate: false,
      multiple: true,
      multiPinSelected: true,
      multiSelectAll: true,
      placeholder: 'Sites',
      search: true,
      searchDisabled: false,
      searchFocus: true,
      stayOpen: false,
    });

    tail.select.inst['tail-1'].on('change', (item, state) => {

      currentGroup = item.key;

      document.querySelector('#member-list').innerHTML = '';
      document.querySelector('#member-container').classList.remove('d-none');

      document.querySelector('#accordion-members-header > span').innerText = `${currentGroup} Members`;
      document.querySelector('#accordion-members-count').innerText = `(${groups[item.key].length})`;

      for (let e of groups[item.key].sort((a, b) => {
        let nameA = userList.get(a).toLowerCase().match(/( .*?$)/i);
        let nameB = userList.get(b).toLowerCase().match(/( .*?$)/i);

        return (nameA < nameB ? -1 : 1);
      })) {
        document.querySelector('#member-list').innerHTML += `<div>(${e}) ${userList.get(e)}</div>`;
      }
    });

    tail.select.inst['tail-2'].updatePin(tail.select.inst['tail-2'].options.items['#'][gadget.site]);
  });
}

/**
 * Updates checkbox booleans and whether or not the submit button is disabled.
 */
function updateParams() {
  includeFolders = document.querySelector('#checkbox-folders').checked;
  includeFiles = document.querySelector('#checkbox-files').checked;

  document.querySelector('#submit').disabled = !includeFolders && !includeFiles;
}

/**
 * Runs on submit, adjusts UI, and starts running reports.
 */
function run() {

  document.querySelector('#run').classList.add('d-none');
  document.querySelector('#progress').classList.remove('d-none');
  document.querySelector('#empty-container').classList.add('d-none');
  document.querySelector('#accordions').innerHTML = '';
  document.querySelector('#accordion-empty-content').innerHTML = '';

  currentDirectoryIndex = currentFileIndex = finishedDirectoryCount = finishedFileCount = 0;
  selectedSites = Array.from(document.querySelector('#select-sites').selectedOptions).map(e => e.value);
  final = {};
  emptySites = [];

  for (let i = 0; i < MAX_STACK; i++) {
    if (includeFolders) runReportDirectories(); // TODO: implement conditional statement
    if (includeFiles) runReportFiles();
  }
}

/**
 * Updates the progress bar and progress text.
 */
function updateProgress() {
  let first = (includeFolders ? finishedDirectoryCount : 0) + (includeFiles ? finishedFileCount : 0);
  let last = (includeFolders && includeFiles ? selectedSites.length * 2 : selectedSites.length);

  document.querySelector('#live-count').innerText = `Operations: ${first}/${last}`;
  document.querySelector('.progress-bar').style.width = `${(100 * (first / last))}%`;
}

/**
 * Runs the next directories report or wraps up if finished.
 */
function runReportDirectories() {
  updateProgress();
  if (currentDirectoryIndex < selectedSites.length) checkDirectories(selectedSites[currentDirectoryIndex++]);
  else wrapUp();
}

/**
 * Runs the next files report or wraps up if finished.
 */
function runReportFiles() {
  updateProgress();
  if (currentFileIndex < selectedSites.length) checkFiles(selectedSites[currentFileIndex++]);
  else wrapUp();
}

/**
 * Runs the custom report for directories.
 * @param {String} site The site to run the report on
 */
function checkDirectories(site) {

  api.custom_report({
    report: 'directories',
    all: true,
    d_access: 'on',
    site: site,
  }).then(r => {

    let results = [];

    for (let e of r.records) {
      if (e.d_access === currentGroup && !e.d_address.includes('/OMNI-INF')) results.push(e);
    }

    if (!final[site]) final[site] = {};
    final[site].directories = results.map(e => {
      return e.d_address;
    });

    finishedDirectoryCount++;
    runReportDirectories();
  });
}

/**
 * Runs the custom report for sites.
 * @param {String} site The site to run the report on
 */
function checkFiles(site) {

  api.custom_report({
    report: 'pages',
    all: true,
    p_access: 'on',
    p_access_group: currentGroup,
    site: site,
  }).then(r => {

    let results = [];

    for (let e of r.records) {
      if (!e.p_address.includes('/OMNI-INF')) results.push(e);
    }

    if (!final[site]) final[site] = {};
    final[site].files = results.map(e => {
      return e.p_address;
    });

    finishedFileCount++;
    runReportFiles();
  });
}

/**
 * Runs after all the reports have finished, processes the data, and displays it.
 */
function wrapUp() {

  if ((includeFolders ? finishedDirectoryCount < selectedSites.length : false)
    || (includeFiles ? finishedFileCount < selectedSites.length : false)) return;

  document.querySelector('#run').classList.remove('d-none');
  document.querySelector('#progress').classList.add('d-none');

  let emptyCount = 0;

  for (let site in final) {
    let a;

    if (final[site].directories && final[site].files) {
      a = final[site].directories.concat(final[site].files).sort((a, b) => {
        return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
      });
    } else if (final[site].directories) a = final[site].directories;
    else if (final[site].files) a = final[site].files;
    else console.log('%cNEITHER DIRECTORIES NOR FILES', 'color: red;');

    final[site].merged = a;

    let html = '';

    for (let e of a) {
      html += `<div>${e.includes('.') ? '📄' : '📁'} <a href="${OUPath(e, !e.includes('.'), site)}" target="_blank">${e}</a></div>`;
    }

    if (a.length === 0) {
      emptyCount++;
      document.querySelector('#accordion-empty-content').innerHTML += `<div>${site}</div>`;
      emptySites.push(site);
    } else document.querySelector('#accordions').innerHTML += generateAccordion(site, html, a.length);
  }

  if (emptyCount > 0) {
    document.querySelector('#empty-container').classList.remove('d-none');
    document.querySelector('#accordion-empty-count').innerText = `(${emptyCount})`;
  }

  prepareCSV();
}

/**
 * Returns an HTML string of an accordion.
 * @param {String} title Header text for the accordion
 * @param {String} content HTML string for the content section of the accordion
 * @param {Number} count Optional number that is on the far right of the header
 * @returns {string} HTML of the accordion
 */
function generateAccordion(title, content, count) {

  return `
  <div id="accordion-${title}" class="card">
    <div id="accordion-${title}-header" class="card-header" type="button" data-toggle="collapse" data-target="#accordion-${title}-collapse" aria-expanded="true" aria-controls="accordion-${title}-content">
      <span>${title}</span>
      ${count ? `<span class="float-right">(${count})</span>` : ''}
    </div>
    <div id="accordion-${title}-collapse" class="collapse" aria-labelledby="accordion-${title}-header" data-parent="#accordion-${title}">
      <div class="card-body">
        <div id="accordion-${title}-content">${content}</div>
        <button class="btn btn-block btn-sm btn-light mt-2" data-toggle="collapse" data-target="#accordion-${title}-collapse" aria-controls="accordion-${title}-collapse">Collapse</button>
      </div>
    </div>
  </div>
  `;
}

/**
 * Prepares the CSV for download.
 */
function prepareCSV() {

  let arr = [[`Results for access group: ${currentGroup}`]];

  for (let site in final) {
    if (final[site].merged.length === 0) continue;

    arr.push([], [`Results for ${site}`], ['Site', 'Path', 'URL']);

    for (let e of final[site].merged) {
      arr.push([site, e, OUPath(e)]);
    }
  }

  if (emptySites.length > 0) {
    arr.push([], ['Sites Without Results']);

    for (let e of emptySites) {
      arr.push([e]);
    }
  }

  buildCSV({
    array: arr,
    filename: 'access_group_finder',
    includeDate: true,
  });
}