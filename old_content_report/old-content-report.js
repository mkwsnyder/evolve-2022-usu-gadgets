/**
 * @author Mark Snyder
 * @copyright Copyright 2019-2022 Utah State University
 */

let api, fileBrowser, gadgetModal;

let startPath; // ''
let startDate; // int
let allPages; // []

$(() => {

  $('.date-picker').datepicker({
    assumeNearbyYear: true,
    autoclose: true,
    // clearBtn: false,
    endDate: '0d',
    // minViewMode: 0,
    maxViewMode: 1,
    format: 'mm/dd/yy',
    // startDate: 'Jan 1999',
    // setDate: 'Mar 2017',
    // todayBtn: true,
    // defaultViewDate: 'today',
    todayHighlight: true,
  }).on('changeDate', (selected) => {
    if (isNaN(Date.parse(selected.date))) Date.now();
    else startDate = Date.parse(selected.date);
    doUpdate();
  });

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
  gadgetModal = new GadgetModal();

  api = new OMNI_API({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'old_content_report',
  });

  fileBrowser = new OU_FileBrowser({
    api: api,
    callback: fileBrowserHandler,
    includePages: false,
    includeBinaries: false,
  });

  startPath = '/';
  startDate = Date.now();
  allPages = [];

  document.querySelector('#input-filepath').addEventListener('focus', () => {
    toggleSidePanel('file-browser', 'right');
    this.blur();
  });
}

/**
 * Starts gathering info from API and eventually displays results.
 */
function run() {

  document.querySelector('#start-app').classList.add('d-none');
  document.querySelector('#progress').classList.remove('d-none');
  document.querySelector('#progress-text').innerText = `Found 0 pages in ${startPath}`;

  crawl(startPath).then(() => {

    let count = 0;
    document.querySelector('#progress-text').innerText = `Checking pages: ${count}/${allPages.length}`;
    document.querySelector('#progress .progress').classList.remove('d-none');

    for (let entry of allPages) {

      api.files_log({path: entry.staging_path}).then(r => {

        count++;
        document.querySelector('#progress-text').innerText = `Checking pages: ${count}/${allPages.length}`;
        document.querySelector('#progress .progress-bar').style.width = `${(count / allPages.length) * 100}%`;

        let modified = false;
        let published = false;

        for (let i = r.length - 1; i >= 0; i--) {
          if (modified && published) break;
          if (!modified && r[i].type.startsWith('Saved from')) {

            entry.modified = {
              date: r[i].date_format,
              username: r[i].username,
            };

            modified = true;
          } else if (!published && r[i].type.startsWith('File Publish')) {

            entry.published = {
              date: r[i].date_format,
              username: r[i].username,
            };

            published = true;
          }
        }

        if (count === allPages.length) {
          document.querySelector('#progress').classList.add('d-none');
          document.querySelector('#post-search').classList.remove('d-none');

          for (let e of document.querySelectorAll('.update-on')) {
            e.addEventListener('change', doUpdate);
          }

          createAll();
          doUpdate();
        }
      });
    }
  });
}

/**
 * Creates all of the DOM elements.
 */
function createAll() {

  let fragment = document.createDocumentFragment();
  for (let page of allPages) {
    let container = document.createElement('div');
    let link = document.createElement('a');
    let days = document.createElement('span');

    container.dataset.path = page.staging_path;
    link.href = page.ou_path;
    link.target = '_blank';
    link.innerText = page.staging_path;

    days.classList.add('float-right', 'days');

    container.appendChild(link);
    container.appendChild(document.createElement('br'));

    let published = document.createElement('span');
    container.dataset.published = page.published ? Date.parse(page.published.date).toString() : -1;
    published.classList.add('d-none', 'published');
    published.innerText = `Last Published: ${page.published ? page.published.date : 'Never'}`;
    container.appendChild(published);

    let modified = document.createElement('span');
    container.dataset.modified = page.modified ? Date.parse(page.modified.date).toString() : -1;
    modified.classList.add('d-none', 'modified');
    modified.innerText = `Last Modified: ${page.modified ? page.modified.date : 'Never'}`;
    container.appendChild(modified);

    container.appendChild(days);
    container.appendChild(document.createElement('hr'));

    fragment.appendChild(container);
  }
  document.getElementById('my-list').appendChild(fragment);
  document.querySelector('#results-end').classList.remove('d-none');
}

/**
 * Updates the DOM elements whenever the user changes sorting or another parameter.
 */
function doUpdate() {

  let selType = document.querySelector('#select-type');
  let selSort = document.querySelector('#select-sort');

  let type = selType.options[selType.selectedIndex].value;
  let notType = selType.options[selType.selectedIndex === 0 ? 1 : 0].value;
  let sort = selSort.options[selSort.selectedIndex].value;

  let arr = [];

  let todayNumBetterNamePlz = Date.now();

  for (let el of document.querySelectorAll('#my-list > div')) {
    if (el.dataset[type] < startDate) {
      el.classList.remove('d-none');

      el.querySelector(`.${type}`).classList.remove('d-none');
      el.querySelector(`.${notType}`).classList.add('d-none');
      if (el.dataset[type] !== '-1') {
        let num = Math.floor((todayNumBetterNamePlz - el.dataset[type]) / 86400000);
        el.querySelector('.days').innerText = `${num} Day${num !== 1 ? 's' : ''} Ago`;
      } else {
        el.querySelector('.days').innerText = '';
      }

      arr.push(el);
    } else el.classList.add('d-none');
  }

  arr.sort((a, b) => {
    if (sort === 'old') return a.dataset[type].localeCompare(b.dataset[type]);
    if (sort === 'new') return b.dataset[type].localeCompare(a.dataset[type]);
    if (sort === 'az') return a.dataset.path.localeCompare(b.dataset.path);
    if (sort === 'za') return b.dataset.path.localeCompare(a.dataset.path);
  });

  for (let el of arr) {
    el.parentNode.appendChild(el);
  }

  prepareCSV();
}

/**
 * Handler function for the file browser.
 * @param {String} path The directory path from the file browser.
 */
function fileBrowserHandler(path) {
  startPath = path;
  document.querySelector('#input-filepath').value = startPath;
}

/**
 * Recursive function that crawls directories and finds all of the pages.
 * @param {String} path Relative file path to crawl.
 * @returns {*} Returns a promise to handle mass asynchronous requests.
 */
function crawl(path) {

  return api.files_list({path: path}).then(r => {

    let proms = [];

    for (let entry of r.entries) {

      if (entry.file_type === 'dir') {

        proms.push(crawl(entry.staging_path));

      } else if (entry.file_type === 'pcf' && !entry.file_name.includes('_props.pcf')) {

        allPages.push({
          staging_path: entry.staging_path, // staging first, then alphabetical
          date: entry.file_date_format, // used to simplify choosing modified date vs publish date
          file_date_format: entry.file_date_format,
          file_name: entry.file_name,
          file_type: entry.file_type,
          http_path: entry.http_path,
          ou_path: gadget.msghost + gadget.hostbase + '/previewedit' + entry.staging_path,
          src_tag: entry.src_tag,
        });

        document.querySelector('#progress-text').innerText = `Found ${allPages.length} pages in ${startPath}`;

      } else {
        // don't do anything
      }
    }
    r = null;
    return Promise.all(proms);
  });
}

/**
 * Prepares the CSV for download.
 */
function prepareCSV() {

  let final = [['Page', 'Modified', 'Published', 'URL']];

  let selType = document.querySelector('#select-type');
  let selSort = document.querySelector('#select-sort');

  let type = selType.options[selType.selectedIndex].value;
  let sort = selSort.options[selSort.selectedIndex].value;

  // Is this sorting solution ugly? Yes. Judgeth not a man for the code he writeth when at his wits end,
  allPages.sort((a, b) => {
    // if (sort === 'old') return a[type] && b[type] ? (Date.parse(a[type].date).toString() < Date.parse(b[type].date).toString() ? -1 : (Date.parse(a[type].date).toString() < Date.parse(b[type].date).toString() ? 1 : 0)) : a[type] ? 1 : -1;
    // if (sort === 'new') return b[type] && a[type] ? (Date.parse(b[type].date).toString() < Date.parse(a[type].date).toString() ? -1 : (Date.parse(b[type].date).toString() < Date.parse(a[type].date).toString() ? 1 : 0)) : b[type] ? 1 : -1;
    if (sort === 'old') return a[type] && b[type] ? Date.parse(a[type].date).toString().localeCompare(Date.parse(b[type].date).toString()) : a[type] ? 1 : -1;
    if (sort === 'new') return a[type] && b[type] ? Date.parse(b[type].date).toString().localeCompare(Date.parse(a[type].date).toString()) : b[type] ? 1 : -1;
    // if (sort === 'az') return a.staging_path < b.staging_path ? -1 : a.staging_path > b.staging_path ? 1 : 0;
    // if (sort === 'az') return b.staging_path < a.staging_path ? -1 : b.staging_path > a.staging_path ? 1 : 0;
    if (sort === 'az') return a.staging_path.localeCompare(b.staging_path);
    if (sort === 'za') return b.staging_path.localeCompare(a.staging_path);
  });

  for (let page of allPages) {

    final.push([
      page.staging_path,
      page.modified ? page.modified.date : 'n/a',
      page.published ? page.published.date : 'n/a',
      page.ou_path,
    ]);
  }

  buildCSV({
    array: final,
    filename: 'old_content_report',
  });
}

// ======== RESEARCH ========

// /files/list and /files/versions

// use files/log to check if published normally and not a "Site Publish to <sitename>" or "Directory Publish to <sitename>"
// also use files/log to check for date modified? "Saved from [Source Editor/WYSIWYG]"
// also also, files/log is in reverse order (entry 0 was page creation or whatever)
