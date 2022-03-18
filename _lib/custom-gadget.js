/**
 * @author Mark Snyder
 * @author Michael Hixon
 * @copyright Copyright 2019-2021 Utah State University
 */

/**
 * Documentation Standards as per Google's JSDoc Standards:
 * https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler
 * The following is an example.
 **
 * Describes the purpose of the function.
 * @param {type} paramName This describes the purpose of the param.
 * @param {*} anyType This param doesn't have a declared type.
 * @return {boolean} This describes what the function returns.
 * @deprecated Use otherFunction().
 */

/**
 * The OmniFileBrowser creates a separate screen in the gadget that lets the
 * user browse and select a directory for the site they are on.
 *
 * By default toggleSidePanel('file-browser', 'right') can be used to show/hide the browser.
 *
 * The configuration can take the following options:
 * - **api** (OmniAPI) – Reference to an instance of the OmniAPI.
 * - **callback** (function) – Callback function that runs when the user exits
 * the browser and is passed the path for the selected directory path.
 * - **includePages** (boolean) – When set to true, pages are included in the browser (defaults to false).
 * - **includeBinaries** (boolean) – When set to true, binaries are included in the browser (defaults to false).
 * - **side** (String) – Which side the browser should slide in and out of (defaults to 'right').
 *
 * @param {Object} config Configuration object.
 */
class OmniFileBrowser {

  constructor(config = {}) {

    if (!(config.api instanceof OmniAPI)) {
      console.log('Error: The OmniFileBrowser requires a reference to an instance of the OmniAPI to function.');
      return;
    }

    this.includePages = config.includePages !== undefined ? config.includePages : false;
    this.includeBinaries = config.includeBinaries !== undefined ? config.includeBinaries : false;
    this.side = config.side || 'right';
    this.callback = config.callback || this.callback;

    this.api = config.api;
    this.callbackOn = 'close';
    this.selectedPath = '/';

    this.createBrowser();
  }

  callback(path) {
    console.log('No assigned callback function for OmniFileBrowser');
  }

  createBrowser() {

    let browser = document.createElement('div');
    browser.id = 'file-browser';
    browser.classList.add('hide-right', 'gadget-panel');

    let top = document.createElement('div');
    top.classList.add('top');

    let header = document.createElement('h5');
    header.innerText = 'File Browser';

    let close = document.createElement('button');
    close.classList.add('close');
    close.style.fontWeight = 'lighter';
    close.innerHTML = '&#10132;';
    close.addEventListener('click', () => {
      toggleSidePanel('file-browser', 'right');
      if (this.callbackOn === 'close') this.callback(this.selectedPath);
    });

    top.appendChild(header);
    top.appendChild(close);
    top.appendChild(document.createElement('hr'));

    browser.appendChild(top);
    browser.appendChild(this.createFolderElement('Home', '/'));

    if (this.side === 'right') document.querySelector('body').appendChild(browser);
    else if (this.side === 'left') document.querySelector('body').prepend(browser);
    else console.log('Invalid config (side) passed to File Browser.');
  }

  /**
   * Gets the contents of a given directory and adds them to the file browser.
   * Executed on site select and folder select.
   * @param path
   */
  generateSubDirectory(path) {

    let content = document.querySelector(`[data-content="${path}"]`);

    if (content.dataset.opened === 'false') {

      let loading = document.createElement('div');

      let span = document.createElement('span');
      span.innerText = 'Loading...';
      span.classList.add('ml-2');

      let spinner = document.createElement('div');
      spinner.classList.add('spinner-border', 'spinner-border-sm', 'ml-2');

      span.appendChild(spinner);
      loading.appendChild(span);
      content.appendChild(loading);

      this.api.files_list({path: path}).then(r => {

        loading.remove();

        content.dataset.opened = 'true';
        let contentCount = 0;

        for (let entry of r.entries) {
          if (entry.file_type === 'dir') {
            content.appendChild(this.createFolderElement(entry.file_name, entry.staging_path));
            contentCount++;
            // countDirectory(entry.staging_path);
          } else if (this.includePages && entry.file_type === 'pcf') {
            content.appendChild(this.createPageElement(entry.file_name, entry.staging_path));
          } else if (this.includeBinaries && entry.file_type !== 'pcf') {
            // binaries
          }
        }

        if (contentCount === 0) {
          let empty = document.createElement('div');
          empty.innerText = '(no subfolders)';
          empty.classList.add('ml-2');
          content.appendChild(empty);
        }
      });
    }
  }

  /**
   * Generates folders for the file browser.
   * @param label
   * @param path
   * @returns {HTMLDivElement}
   */
  createFolderElement(label, path) {
    let folder = document.createElement('div');
    let header = document.createElement('div');
    let collapse = document.createElement('div');

    folder.classList.add('folder');

    header.classList.add('header');
    header.dataset.directory = path;
    header.innerText = label;
    header.dataset.target = `[data-content="${path}"]`;
    header.appendChild(document.createElement('span'));

    header.addEventListener('click', () => {
      this.generateSubDirectory(path);
      folder.classList.toggle('open');
      this.selectedPath = path;
      // TODO: unhighlight all selected folders, highlight this one, but only if selecting by folder

      for (let h of document.querySelectorAll('.header.selected')) {
        h.classList.remove('selected');
      }

      header.classList.add('selected');
    });

    collapse.classList.add('folder-contents');
    collapse.dataset.content = path;
    collapse.dataset.opened = 'false';

    folder.appendChild(header);
    folder.appendChild(collapse);

    return folder;
  }

  /**
   * Generates pages for the file browser.
   * @param label
   * @param path
   * @returns {HTMLDivElement}
   */
  createPageElement(label, path) {

    let page = document.createElement('div');
    page.innerText = label;
    page.dataset.path = path;
    page.classList.add('page');

    if (this.callbackOn === 'page') {
      page.addEventListener('click', () => {
        this.callback(path);
        // this.toggleBrowser();
        toggleSidePanel('file-browser', 'right');
      });
    }

    return page;
  }
}

/**
 * Gets a list of users from Omni CMS and makes them easily accessible via the findByUsername() function.
 *
 * The configuration can take the following options:
 * - **api** (OmniAPI) – Reference to an instance of the OmniAPI.
 *
 * @param {Object} config Configuration object.
 */
class OmniUserList {

  constructor(config = {}) {

    this.userList = {};

    if (!config.api) {
      console.log('OmniUserList must be passed a reference to the OmniAPI in the config.');
    } else {
      config.api.users_list().then(r => {
        for (let user of r) {

          this.userList[user.username] = `${user.first_name} ${user.last_name}`;
        }
      });
    }
  }

  // replaced by OmniUserList.get() for the sake of brevity
  findByUsername(username) {
    return this.get(username);
  }

  /**
   * Gets user's full name based on their username.
   * @param {String} username Username to look up
   * @returns {String} Full name of the user
   */
  get(username) {
    try {
      return this.userList[username];
    } catch (e) {
      console.log(`%cError:%cCannot find username ${username}`, 'color: red;');
    }
  }
}

/**
 * Creates a modal that can be shown and modified at runtime.
 *
 * Functions:
 * - toggle()
 * - show()
 * - close()
 * - setTitle(String)
 * - setBody(String)
 * - setBodyHTML(String)
 * - setType(String)
 * - showDownload(Array, String)
 *
 * The configuration can take the following options:
 * - **api** (OmniAPI) – Reference to an instance of the OmniAPI.
 *
 * @param {Object} config Configuration object.
 */
class GadgetModal {

  constructor(config = {}) {

    this.div = document.createElement('div');
    this.div.id = 'gadget-modal';
    this.div.classList.add('modal');
    this.div.innerHTML = `
      <div class="modal-dialog modal-dialog-scrollable" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${config.title}</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p>${config.body}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-dismiss="modal">Close</button>
            <a id="gadget-modal-download" type="button" class="btn btn-sm btn-outline-primary d-none">Download</a>
          </div>
        </div>
      </div>
    `;

    document.querySelector('body').appendChild(this.div);
    this.modal = $('#gadget-modal');
    this.header = this.div.querySelector('.modal-header');
    this.title = this.div.querySelector('.modal-title');
    this.body = this.div.querySelector('.modal-body');

    if (config.type) {
      this.setType(config.type);
    }
  }

  toggle() {
    this.modal.modal('toggle');
  }

  show() {
    this.modal.modal('show');
  }

  close() {
    this.modal.modal('close');
  }

  setTitle(title) {
    this.title.innerText = title;
  }

  setBody(content) {
    this.body.innerText = content;
  }

  setBodyHTML(html) {
    this.body.innerHTML = html;
  }

  /**
   * Sets the color of the modal.
   * @param {String} type Bootstrap 4 color type (default, primary, secondary, success, error, warning, info)
   */
  setType(type) {

    this.header.classList.remove('bg-primary', 'bg-secondary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');

    switch (type) {
      case 'default':
        // this.header.classList.add('');
        this.header.classList.remove('text-white');
        break;
      case 'primary':
        this.header.classList.add('bg-primary', 'text-white');
        break;
      case 'secondary':
        this.header.classList.add('bg-secondary', 'text-white');
        break;
      case 'success':
        this.header.classList.add('bg-success', 'text-white');
        break;
      case 'error':
        this.header.classList.add('bg-danger', 'text-white');
        break;
      case 'warning':
        this.header.classList.add('bg-warning', 'text-white');
        break;
      case 'info':
        this.header.classList.add('bg-info', 'text-white');
        break;
      default:
        this.header.classList.remove('text-white');
    }
  }

  /**
   * Shows a download button that can have data attached to it.
   * @param {Array} data 2D array that will become the file to download.
   * @param {String} title Title of the file to be downloaded.
   */
  showDownload(data, title = 'gadget-download') {

    let content = 'data:text;charset=utf-8,';

    for (let row of data) {
      content += row + '\r\n';
    }

    let url = encodeURI(content);
    url = url.replace(/#/g, '%23');

    document.querySelector('#gadget-modal-download').href = url;
    document.querySelector('#gadget-modal-download').download = `${title}-${generateDateString()}.txt`;
    document.querySelector('#gadget-modal-download').classList.remove('d-none');
  }
}

/**
 * Prepares a CSV file for download.
 *
 * Config items:
 * - {Array} **array** – 2D array the will be the body of the file (required).
 * - {String} **buttonID** – optional, defaults to "csv-export".
 * - {String} **filename** – optional, but recommended, defaults to "export".
 * - {Boolean} **includeDate** – optional, includes date in file name, defaults to *false*.
 * - {Boolean} **includeSite** – optional, includes site in file name, defaults to *true*.
 *
 * @param {Object} config Configuration object
 */
function buildCSV(config = {}) {

  if (!config.array) {
    console.log('buildCSV() function requires an array');
    return;
  }

  let buttonID = config.buttonID || 'csv-export';
  let filename = config.filename || 'export';
  let includeDate = config.includeDate !== undefined ? config.includeDate : false;
  let includeSite = config.includeSite !== undefined ? config.includeSite : true;

  let button = document.querySelector(`#${buttonID}`);

  console.log('includeDate', includeDate);
  console.log('includeSite', includeSite);

  let content = 'data:text/csv;charset=utf-8,';

  config.array.forEach((subArray) => {
    let row = subArray.join(',');
    content += row + '\r\n';
  });

  let url = encodeURI(content);
  url = url.replace(/#/g, '%23');

  button.href = url;
  button.download = `${filename}${includeSite ? '-' + gadget.site : ''}${includeDate ? '-' + generateDateString() : ''}.csv`;
  button.classList.remove('disabled');
}

/**
 * Filters out directories that shouldn't include pcf files.
 * @param {Object} e The entry from the API response.
 * @param {boolean} includeBinaries If true, folders that typically contain binary files will be included.
 * @returns {boolean} If true, then the given directory is valid.
 */
function directoryFilter(e, includeBinaries = false) { // most common case to least common case
  return e.file_type === 'dir'
    && !e.staging_path.includes('/_resources')
    && (includeBinaries ? true : (
      !e.staging_path.includes('images')
      && !e.staging_path.includes('files')
    ));
}

/**
 * Lets the user know that the gadget failed to load.
 */
function gadgetFetchError() {
  document.querySelector('#loading').classList.add('text-danger');
  document.querySelector('#loading').classList.remove('row');
  document.querySelector('#loading').innerHTML = `
  <h3>Failed to Load Gadget</h3>
  <div>Try refreshing the page.</div>
  `;
}

/**
 * Returns a date string in the format of YYYY-MM-DD--HH--MM.
 * @returns {string}
 */
function generateDateString() {
  let d = new Date();
  return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}-${('0' + d.getDate()).slice(-2)}_${('0' + d.getHours()).slice(-2)}-${('0' + d.getMinutes()).slice(-2)}`;
}

/**
 * Filters out all files except .inc files.
 * @param {Object} e The entry from the API response.
 * @returns {boolean} If true, then the given directory is valid.
 */
function incFilter(e) {
  return e.file_name.includes('.inc');
}

/**
 * Gets the staging URL for a file given a relative path.
 * @param {String} path relative path of desired staging URL
 * @param {Boolean} isDir If true, the returned URL will be formatted for directories.
 * @param site
 * @return staging URL
 */
function OUPath(path, isDir = false, site) {
  let hostbase;
  if (site) hostbase = gadget.hostbase.slice(0, gadget.hostbase.lastIndexOf('/') + 1) + site;
  else hostbase = gadget.hostbase;
  return gadget.apihost + hostbase + (isDir ? '/browse/staging' : '/previewedit') + path;
}

/**
 * Filters out all files except pcf files.
 * @param {Object} e The entry from the API response.
 * @returns {boolean} If true, then the given directory is valid.
 */
function pcfFilter(e) {
  return e.file_type === 'pcf'
    && !e.file_name.includes('_props');
}

/**
 * Filters out extraneous info from a path object. Can be used nicely with the Array.map function.
 * Usage: `const simplePath = simplfyPath(path);` or
 * `const simplePaths = paths.map(simplifyPath);`
 * @param {Object} e path object from the API
 */
function simplifyPath(e) {
  return {
    staging_path: e.staging_path,
    http_path: e.http_path,
    ou_path: OUPath(e.staging_path),
    remote_path: e.remote_path,
    dm_tag: e.dm_tag,
    src_tag: e.src_tag,
    file_date: e.file_date,
    file_date_format: e.file_date_format,
    file_name: e.file_name,
    file_size: e.file_size,
    file_type: e.file_type,
  };
}

/**
 * Sorts an array of objects by a key-value pair of each object.
 * @param arr The array to sort.
 * @param sortKey The key pair used to sort the objects by.
 * @returns {Array} Sorted array.
 */
function sortObjs(arr, sortKey) {
  if (arr.length === 0) return [];
  let sorted = [];

  for (let item of arr) {
    for (let i = 0; i <= arr.length; i++) {
      if (sorted.length === i) {
        sorted.push(item);
        break;
      } else if (typeof item[sortKey] === 'string') {
        if (item[sortKey].localeCompare(sorted[i][sortKey]) === -1) {
          sorted.splice(i, 0, item);
          break;
        }
      } else if (item[sortKey] < sorted[i][sortKey]) {
        sorted.splice(i, 0, item);
        break;
      }
    }
  }
  return sorted;
}

/**
 * Toggles a side panel to slide in from either the left or right.
 * @param {String} id The ID of the panel to slide.
 * @param {String} side The side it should slide to/from, 'left' or 'right'.
 */
function toggleSidePanel(id, side = 'left') {
  document.querySelector('#main').classList.toggle(side === 'left' ? 'hide-right' : 'hide-left');
  document.querySelector(`#${id}`).classList.toggle(side === 'left' ? 'hide-left' : 'hide-right');
  setTimeout(() => {
    let trigger = document.querySelector('#gadget-toolbar-trigger');
    if (trigger) {
      trigger.classList.toggle('d-none');
    }
    document.activeElement.blur();
  }, 100);
}