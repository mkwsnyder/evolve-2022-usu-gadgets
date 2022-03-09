/**
 * @author Mark Snyder
 * @copyright Copyright 2019-2022 Utah State University
 */

let api, fileBrowser, gadgetModal;

let noTitle, empty, short, long, error; // []
let grandTotal; // int
let startPath; // string

const CHAR_MIN = 75;
const CHAR_MAX = 320;

$(() => {

  document.querySelector('#input-filepath').addEventListener('focus', () => {
    toggleSidePanel('file-browser', 'right');
    this.blur();
  });

  gadget.ready().then(gadget.fetch).then(() => {

    startPath = '/';

    gadgetModal = new GadgetModal();

    api = new OMNI_API({
      debug: false,
      logging: false,
      modal: gadgetModal,
      name: 'quality_report',
    });

    fileBrowser = new OU_FileBrowser({
      api: api,
      callback: fileBrowserHandler,
      includePages: false,
      includeBinaries: false,
    });

    document.querySelector('#loading').style.display = 'none';
    document.querySelector('#main').style.display = 'block';
    document.querySelector('#gadget-toolbar-container').style.display = 'block';
  });
});

/**
 * Starts the gadget.
 */
function run() {
  noTitle = [];
  empty = [];
  short = [];
  long = [];
  error = [];
  grandTotal = 0;

  document.querySelector('#start-app').classList.add('d-none');
  document.querySelector('#progress').classList.remove('d-none');
  document.querySelector('#progress-text').innerText = `Found 0 pages in ${startPath}`;

  crawlDirs(startPath).then(() => {
    noTitle = sortObjs(noTitle, 'staging_path');
    empty = sortObjs(empty, 'staging_path');
    short = sortObjs(short, 'staging_path');
    long = sortObjs(long, 'staging_path');

    updateGUI();
    prepareCSV();
  });
}

/**
 * Recursively crawls the directories of a given site to get all the files and pages.
 * @param {String} dir The directory to search.
 * @returns {Promise} Returns promises for every initialized API call to handle asynchronicity.
 */
function crawlDirs(dir = '/') {

  return api.files_list({ path: dir }).then(resp => {
    const {entries} = resp;
    let proms = [];

    for (let entry of entries) {
      if (directoryFilter(entry)) proms.push(crawlDirs(entry.staging_path));
      else if (pcfFilter(entry)) proms.push(checkProps(simplifyPath(entry)));
    }

    return Promise.all(proms);
  });
}

/**
 * Checks the page properties for a given page and pushes it to any applicable global arrays.
 * @param {Object} minFile An object containing page properties for a given page.
 * @returns {Q.Promise<any> | * | Promise<T | never> | TypeError} Returns a resolved promise once finished.
 */
function checkProps(minFile) {
  return api.files_properties({ path: minFile.staging_path }).then(resp => {
    let tagIndex = -1;
    for (let i = 0; i < resp.meta_tags.length; i++) {
      if (resp.meta_tags[i].name === 'Description') tagIndex = i;
    }

    if (!resp.title || resp.title.length === 0) push(noTitle);
    if (tagIndex >= 0) {
      if (resp.meta_tags[tagIndex].content.length === 0) push(empty);
      else if (resp.meta_tags[tagIndex].content.length < CHAR_MIN) push(short);
      else if (resp.meta_tags[tagIndex].content.length > CHAR_MAX) push(long);
    } else push(empty);

    document.querySelector('#progress-text').innerText = `Found ${grandTotal} pages in ${startPath}`;

    return Promise.resolve();
  }).catch(() => {
    minFile.error = 'File couldn\'t be accessed.';
    console.log('The following file returned invalid information:', minFile);
    error.push(minFile);
    document.getElementById('error').style.display = 'block';
  });

  function push(arr) {
    arr.push(minFile);
    document.getElementById('grand-total').innerText = (++grandTotal).toString();
  }
}

/**
 * Handler function for the file browser.
 * @param {String} path Directory path from the file browser.
 */
function fileBrowserHandler(path) {
  startPath = path;
  document.querySelector('#input-filepath').value = startPath;
}

/**
 * Takes the processed data and pushes it to the GUI.
 */
function updateGUI() {

  document.querySelector('#progress').classList.add('d-none');
  document.querySelector('#grand-total-container').classList.remove('d-none');

  document.getElementById('title-count').innerText = noTitle.length;
  document.getElementById('empty-count').innerText = empty.length;
  document.getElementById('short-count').innerText = short.length;
  document.getElementById('long-count').innerText = long.length;
  document.getElementById('error-count').innerText = error.length;
  document.getElementById('grand-total').innerText = grandTotal;

  if (noTitle.length === 0) document.getElementById('title-success').style.display = 'block';
  if (empty.length === 0) document.getElementById('empty-success').style.display = 'block';
  if (short.length === 0) document.getElementById('short-success').style.display = 'block';
  if (long.length === 0) document.getElementById('long-success').style.display = 'block';

  document.getElementById('spinner').style.display = 'none';

  let arr = [noTitle, empty, short, long, error];

  for (let i = 0; i < arr.length; i++) {

    let frag = document.createDocumentFragment();

    for (let page of arr[i]) {
      let link = document.createElement('a');

      link.textContent = page.staging_path;
      link.href = page.ou_path;
      link.target = '_blank';

      frag.appendChild(link);
      frag.appendChild(document.createElement('hr'));
    }

    switch (i) {
      case 0:
        document.getElementById('title-content').appendChild(frag);
        break;
      case 1:
        document.getElementById('empty-content').appendChild(frag);
        break;
      case 2:
        document.getElementById('short-content').appendChild(frag);
        break;
      case 3:
        document.getElementById('long-content').appendChild(frag);
        break;
      case 4:
        document.getElementById('error-content').appendChild(frag);
        break;
    }
  }
}

/**
 * Prepares an array to passed to the buildCSV() function. Defines the organization of the csv export.
 */
function prepareCSV() {
  let final = [['Missing Title', 'Missing Description', 'Short Description', 'Long Description']];
  let length = 0;

  for (let arr of [noTitle, empty, short, long]) {
    if (arr.length > length) length = arr.length;
  }

  for (let i = 0; i < length; i++) {

    for (let arr of [noTitle, empty, short, long]) { // prevent out of bounds errors
      if (!arr[i]) arr.push({ou_path: ''});
    }

    final.push([noTitle[i].ou_path, empty[i].ou_path, short[i].ou_path, long[i].ou_path]);
  }

  buildCSV({
    array: final,
    filename: 'quality_report',
  });
}