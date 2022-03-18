/**
 * @author Mark Snyder
 * @copyright Copyright 2021-2022 Utah State University
 */

let api, fileBrowser, gadgetModal;

let tagList, results; // []
let cntFound, cntSearched; // int
let startPath; // string

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

  api = new OmniAPI({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'tag_finder',
  });

  // optional
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

  startPath= '/';
  tagList = [];
  results = [];

  return api.tag_list().then(resp => {

    tagList = sortObjs(resp.entries, 'tag');

    let fragment = document.createDocumentFragment();
    for (let el of tagList) {
      let option = document.createElement('option');
      option.value = option.text = el.tag;
      fragment.appendChild(option);
    }
    document.querySelector('#select-tags').appendChild(fragment);

    tail.select('#select-tags', {
      animate: false,
      multiple: false, // TODO: implement the ability to search for more than one tag at a time
      multiPinSelected: true,
      multiSelectAll: false,
      placeholder: 'Tag',
      search: true,
      searchDisabled: false,
      searchFocus: true,
      stayOpen: false,
    });

    return Promise.resolve();
  });
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
 * Resets variables and starts the folder crawl. Once finished, it prints to the page and builds the CSV.
 */
function run() {
  tagList = Array.from(document.querySelector('#select-tags').selectedOptions).map(e => e.value);

  if (tagList.length === 0) {

    gadgetModal.setType('error');
    gadgetModal.setTitle('Error');
    gadgetModal.setBody('You must select a tag.');
    gadgetModal.show();

    return;
  }

  cntFound = 0;
  cntSearched = 0;
  results = [];

  document.querySelector('#results').innerHTML = '';

  crawl(startPath).then(() => {

    results.sort();

    for (let result of results) {
      let div = document.createElement('div');
      let a = document.createElement('a');
      a.innerText = `${result.includes('.') ? '📄' : '📁'} ${result}`;
      a.href = OUPath(result, !result.includes('.'));
      a.target = '_blank';
      div.appendChild(a);
      document.querySelector('#results').appendChild(div);
    }

    prepareCSV();
  });
}

/**
 * Recursive function that crawls directories and finds all of the pages.
 * @param {String} path Relative file path to crawl.
 * @returns {*} Returns a promise to handle mass asynchronous requests.
 */
function crawl(path) {

  api.files_filter_by_tags({
    path: path,
    tag: tagList[0], // TODO: implement the ability to search for more than one tag at a time
  }).then(resp => {

    cntFound += resp.length;
    updateProgress();

    for (let el of resp) {
      results.push(`${path}${path === '/' ? '' : '/'}${el}`);
    }
  });

  return api.files_list({path: path}).then(resp => {

    let proms = [];
    cntSearched += resp.entries.length;
    updateProgress();

    for (let entry of resp.entries) {

      if (entry.file_type === 'dir') {

        proms.push(crawl(entry.staging_path));

      }
    }
    resp = null;
    return Promise.all(proms);
  });
}

/**
 * Updates the live progress count.
 */
function updateProgress() {
  document.querySelector('#progress').innerText = `Files Found: ${cntFound} | Files Searched: ${cntSearched}`;
}

/**
 * Prepares the CSV with the gathered data.
 */
function prepareCSV() {
  final = [
    [`Tag: ${tagList[0]}`],
    ['Path', 'URL']
  ];

  for (let item of results) {
    final.push([item, OUPath(item, (item.includes('.' ? false : true)))])
  }

  buildCSV({
    array: final,
    filename: 'tag_finder',
  });
}