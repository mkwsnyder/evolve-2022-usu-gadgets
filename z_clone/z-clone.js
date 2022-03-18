/**
 * @author
 * @copyright Copyright 2022 Utah State University
 */

/**
 *  First, call `gadget.ready()` to make sure the gadget has obtained an API token
 *   to use for making OU Campus API calls. If your gadget will not make any API calls,
 *   you can dispense with this method. This asynchronous method returns a jQuery
 *   Promise object.
 *
 *   Then, call `gadget.fetch()` to get the gadget's config data from the system. This
 *   method, which also returns a jQuery Promise object, uses the API, which is why it
 *   needs to follow the call to `gadget.ready()`.
 *
 *   If you don't need the config data, you don't need to call gadget.fetch().
 */

let api, fileBrowser, gadgetModal;

// vars

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
  gadgetModal = new GadgetModal();

  api = new OmniAPI({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'gadget_name',
  });

  // optional
  fileBrowser = new OmniFileBrowser({
    api: api,
    callback: fileBrowserHandler,
    includePages: false,
    includeBinaries: false,
  });

  // startup code
}