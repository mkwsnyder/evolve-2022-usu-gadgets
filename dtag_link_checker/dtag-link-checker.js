/**
 * @author Mark Snyder
 * @copyright Copyright 2019-2022 Utah State University
 */

const MAX_STACK = 8;

let api, fileBrowser, gadgetModal;
let final; // []
let httpRoot, startPath; // ''
let finalIndex, batchedCount; // int

$(() => {

  document.querySelector('#input-filepath').addEventListener('focus', () => {
    toggleSidePanel('file-browser', 'right');
    this.blur();
  });

  gadget.ready().then(gadget.fetch).then(() => {

    gadgetModal = new GadgetModal();

    api = new OmniAPI({
      debug: false,
      logging: false,
      modal: gadgetModal,
      name: 'dependency_tag_link_checker',
    });

    fileBrowser = new OmniFileBrowser({
      api: api,
      callback: fileBrowserHandler,
      includePages: false,
      includeBinaries: false,
    });

    startPath = '/';

    api.sites_list().then(r => {
      for (let e of r) {
        if (e.site === gadget.site) {
          httpRoot = e.url.slice(0, -1);
          break;
        }
      }
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
  final = [];
  finalIndex = 0;
  batchedCount = 0;

  document.querySelector('#start-app').classList.add('d-none');
  document.getElementById('progress').style.display = 'block';

  crawlDirs(startPath).then(() => {

    document.getElementById('progress-message').innerText = `Found ${final.length} files in ${startPath}`;
    document.querySelector('.progress.d-none').classList.remove('d-none');

    for (let i = 0; i < MAX_STACK; i++) {
      manager();
      batchedCount++;
    }
  });
}

function fileBrowserHandler(path) {
  startPath = path;
  document.querySelector('#input-filepath').value = startPath;
}

/**
 * Enables the ability to batch network requests in order to prevent high memory usage. Runs code when the gadget is finished.
 */
function manager() {
  if (finalIndex < final.length) {
    let entry = final[finalIndex++];

    if (!entry.dm_tag) products(entry).then(() => {
      manager();
    });
    else subscribers(entry).then(() => {
      manager();
    });

  } else if (finalIndex === final.length) {

    // document.getElementById('progress-count').innerText = '';
    document.getElementById('progress-message').innerText = 'Processing Data...';

    if (--batchedCount === 0) {
      batchedCount = Infinity;
      final = sortObjs(final, 'staging_path');
      final = sortObjs(final, 'subCount');
      prepareCSV();
      updateGUI();
    }
  }
}

/**
 * Recursively crawls the directories of a given site to get all the files and pages.
 * @param dir {String} dir The directory to search.
 * @returns {Promise} Returns promises for every initialized API call to handle asynchronicity.
 */
function crawlDirs(dir = '/') {
  return api.files_list({ path: dir, }).then(resp => {
    const {entries} = resp;
    let proms = [];

    for (let entry of entries) {
      let minFile = simplifyPath(entry);

      if (directoryFilter(minFile, true)) {
        proms.push(crawlDirs(minFile.staging_path));
      } else if (!minFile.file_name.includes('_props.pcf') && !incFilter(minFile) && minFile.file_type !== 'dir') {
        final.push(minFile);
      }
    }
    document.getElementById('progress-message').innerText = `Found ${final.length} files in ${startPath}`;
    return Promise.all(proms);
  });
}

/**
 * Requests and handles the products for pages as they may have multiple dependency tags. Only runs if the file is a
 * pcf, then calls the subscribers() function.
 * @param {Object} minFile An object containing the meta-data for the page.
 * @returns {Q.Promise<any> | * | Promise<T | never> | TypeError} Returns what the subscribers() function returns.
 */
function products(minFile) {
  return api.files_products({ path: minFile.staging_path }).then(prods => {

    for (let prod of prods) {
      if (prod.extension === 'php') {
        minFile.dm_tag = '{{' + prod.type + ':' + prod.id + '}}';
        break;
      }
    }
    prods = null;
    return subscribers(minFile);
  }).catch(() => {
    minFile.error = 'File couldn\'t be accessed.';
    console.log('The following file couldn\'t be accessed:', minFile);
    document.getElementById('error').style.display = 'block';
  });
}

/**
 * Requests and handles the subscribers for a given file, searching based off of the dependency tag.
 * @param {Object} minFile An object containing the meta-data for the page.
 * @returns {Q.Promise<any> | * | Promise<T | never> | TypeError} Returns a resolved promise once finished.
 */
function subscribers(minFile) {

  return api.files_subscribers({ tag: minFile.dm_tag }).then(resp => {

    if (resp.subscribers.pages) {
      minFile.subs = [];

      for (let sub of resp.subscribers.pages) {

        minFile.subs.push({
          http_path: httpRoot + sub.path,
          ou_path: OUPath(sub.path),
          staging_path: sub.path,
        });
      }
      minFile.subCount = minFile.subs.length;
    } else minFile.subCount = 0;

    minFile = null;
    resp = null;

    document.getElementById('progress-message').innerText = `Checking files: ${finalIndex}/${final.length}`;
    document.querySelector('#progress .progress-bar').style.width = `${(finalIndex / final.length) * 100}%`;

    return Promise.resolve();
  }).catch(() => {
    minFile.error = 'File returned no meta-data.';
    console.log('The following file returned invalid information:', minFile);
    document.getElementById('error').style.display = 'block';
  });
}

/**
 * Takes the processed data and pushes it to the GUI.
 */
function updateGUI() {
  let fragUnlinked = document.createDocumentFragment();
  let fragLinked = document.createDocumentFragment();
  let fragError = document.createDocumentFragment();
  let linkedCount = 0;
  let unlinkedCount = 0;
  let errorCount = 0;
  let totalPages = 0;

  document.getElementById('progress').style.display = 'none';

  for (let item of final) {
    let container = document.createElement('div');
    let link = document.createElement('a');
    let br = document.createElement('br');
    let dTag = document.createElement('span');

    link.textContent = item.staging_path;
    link.href = item.file_type === 'pcf' ? item.ou_path : item.http_path;
    link.target = '_blank';
    if (!item.error) dTag.textContent = item.dm_tag;
    else dTag.textContent = 'Error: ' + item.error;

    container.appendChild(link);
    container.appendChild(br);
    container.appendChild(dTag);

    if (item.subs) {
      let subCount = document.createElement('span');
      let subContainer = document.createElement('div');
      let subList = document.createElement('div');

      subCount.textContent = 'Subscribers: ' + item.subs.length;
      subCount.classList.add('float-right');
      subList.classList.add('subs-container');

      for (let sub of item.subs) {
        let sub_link = document.createElement('a');
        let sub_br = document.createElement('br');

        sub_link.textContent = sub.staging_path;
        sub_link.href = sub.ou_path;
        sub_link.target = '_blank';

        subList.appendChild(sub_link);
        subList.appendChild(sub_br);
      }

      subContainer.appendChild(subList);

      container.appendChild(subCount);
      container.appendChild(subContainer);
    }

    container.appendChild(document.createElement('hr'));

    if (item.subs) {
      fragLinked.appendChild(container);
      linkedCount++;
    } else if (item.error) {

      fragError.appendChild(container);
      errorCount++;
    } else {
      fragUnlinked.appendChild(container);
      unlinkedCount++;
    }

    if (item.file_type === 'pcf') totalPages++;
  }

  document.getElementById('final').innerText = 'Total Files: ' + final.length + ' | Total Pages: ' + totalPages;

  document.getElementById('linked-content').appendChild(fragLinked);
  document.getElementById('unlinked-content').appendChild(fragUnlinked);
  document.getElementById('error-content').appendChild(fragError);

  document.getElementById('linked-count').innerText = linkedCount.toString();
  document.getElementById('unlinked-count').innerText = unlinkedCount.toString();
  document.getElementById('error-count').innerText = errorCount.toString();
}

/**
 * Prepares an array to passed to the buildCSV() function. Defines the organization of the csv export.
 */
function prepareCSV() {
  let csv = [['Sub Count', 'Staging Path', 'OU Campus URL', 'Subscribers']];

  for (let entry of final) {
    let line = [entry.subCount ? entry.subCount : '0', entry.staging_path, entry.ou_path];
    if (entry.subs) {
      for (let sub of entry.subs) {
        line.push(sub.ou_path);
      }
    }
    csv.push(line);
  }

  buildCSV({
    array: csv,
    filename: 'dependency_tag_link_check',
  });
}