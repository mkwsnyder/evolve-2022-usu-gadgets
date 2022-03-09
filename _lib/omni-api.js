/**
 * @author Mark Snyder
 * @copyright Copyright 2020-2021 Utah State University
 */

class OMNI_API {

  /**
   * The **OMNI_API** interface is a JavaScript library used for making and
   * logging requests to the Omni CMS API.
   *
   * The configuration can take the following options:
   * - **debug** (boolean) – When set to true, the OMNI_API will log every request to the browser console. Defaults to false.
   * - **logging** (boolean) – When set to true, gadget activity is logged to metadata. Defaults to *true*. This is currently unused.
   * - **modal** (Object) – Reference to a GadgetModal.
   * - **name** (String) – Name of the gadget; this is only used for logging.
   * - **site** (String) – If an API request requires a site as a parameter, and the
   * user did not provide a site, this site will be used. Defaults to the
   * current site in Omni CMS.
   *
   * @param {Object} config Configuration object.
   */
  constructor(config = {}) {
    this.debug = config.debug !== undefined ? config.debug : false;
    this.logging = config.logging !== undefined ? config.logging : false; // unused at the moment
    this.modal = config.modal || new GadgetModal();
    this.name = config.name || ''; // gadget name
    this.site = config.site || (gadget?.site ? gadget.site : '');

    this.apihost = gadget.apihost || 'https://a.cms.omniupdate.com';
    this.account = gadget.account || ''; // TODO EVOLVE: change this to your Omni CMS account
    this.skin = gadget.skin || ''; // TODO EVOLVE: change this to your Omni CMS account
    this.hostbase = gadget.hostbase || `/11/#${this.account}/${this.skin}/${this.site}`;
    this.user = gadget.user || 'unknown user';

    this.errorCnt = 0;
    this.errorLog = [];
  }

  /**
   * Make a GET request to the Omni CMS API.
   * @param endpoint {String} API endpoint.
   * @param data {Object} Parameters for the API request.
   * @returns {*} Response from the Omni CMS API.
   */
  get(endpoint, data) {
    return this.call({
      type: 'GET',
      endpoint: endpoint,
    }, data);
  }

  /**
   * Make a POST request to the Omni CMS API.
   * @param endpoint {String} API endpoint.
   * @param data {Object} Parameters for the API request.
   * @returns {*} Response from the Omni CMS API.
   */
  post(endpoint, data) {
    return this.call({
      type: 'POST',
      endpoint: endpoint,
    }, data);
  }

  // TODO: Make this function private once it's supported in Firefox and Safari (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields)
  call(meta, data) {

    if (this.debug) {
      console.log('%c======== OU API REQUEST ========', 'font-size: large; font-weight: bold;');
      console.log('%c     Gadget:', 'font-weight: bold;', this.name);
      console.log('%cHTTP Method:', 'font-weight: bold;', meta.type);
      console.log('%c   Endpoint:', 'font-weight: bold;', meta.endpoint);
      console.log('%c Parameters:', 'font-weight: bold;', data);
    }

    let defaults = {};

    if (typeof gadget !== 'undefined') defaults.authorization_token = gadget.token;

    return $.ajax({
      type: meta.type,
      url: this.apihost + meta.endpoint,
      data: {...defaults, ...data},
    }).done((r) => {
      if (this.debug) console.log('%c   Response:', 'color: green; font-weight: bold;', r);
      return r;
    }).fail((jqXHR, textStatus, errorThrown) => {
      console.log('%c========= OU API ERROR =========', 'color: firebrick; font-size: large; font-weight: bold;');
      console.log('%c       Gadget:', 'color: firebrick; font-weight: bold;', this.name);
      console.log('%c  HTTP Method:', 'color: firebrick; font-weight: bold;', meta.type);
      console.log('%c     Endpoint:', 'color: firebrick; font-weight: bold;', meta.endpoint);
      console.log('%c   Parameters:', 'color: firebrick; font-weight: bold;', data);
      console.log('%c   Error Code:', 'color: firebrick; font-weight: bold;', jqXHR.responseJSON?.code);
      console.log('%cError Message:', 'color: firebrick; font-weight: bold;', jqXHR.responseJSON?.error);

      if (!jqXHR.responseJSON) {
        console.log('No response JSON provided by the error.');
      }

      this.modal.setType('error');

      // if SESSION_NOT_FOUND
      if (jqXHR.responseJSON?.code === 'SESSION_NOT_FOUND') {

        this.modal.setTitle('Session Not Found');
        this.modal.setBody('Error: Session not found. Try refreshing the page.');

      } else {

        this.errorCnt++;

        this.errorLog.push('');
        this.errorLog.push(new Date().toLocaleTimeString());
        this.errorLog.push(`${meta.type}: ${meta.endpoint}`);
        this.errorLog.push(`Parameters: ${JSON.stringify(data)}`);
        this.errorLog.push(`Error Code: ${jqXHR.responseJSON ? jqXHR.responseJSON?.code : 'No response JSON provided by the error.'}`);
        this.errorLog.push(`Error Message: ${jqXHR.responseJSON ? jqXHR.responseJSON?.error : 'No response JSON provided by the error.'}`);

        let d = new Date();

        this.modal.setTitle('Gadget API Error');
        this.modal.setBodyHTML(`${this.errorCnt === 1 ? 'An error has' : `${this.errorCnt} errors have`} occurred. Please download the error log and send it to the <a href="mailto:">your team name (email@domain.com)</a>.`); // TODO EVOLVE: add your own support email
        this.modal.showDownload([...[`Error Log for ${this.name} [${d.getFullYear()}/${('0' + (d.getMonth() + 1)).slice(-2)}/${('0' + d.getDate()).slice(-2)}]`], ...this.errorLog], `gadget-error-log-${this.name}`);
      }

      this.modal.show();

      if (this.debug) {
        // log error to the server
      }
      // end fail
    });
  }

  // ========== ENDPOINTS ==========

  // TODO: Make this function private once it's supported in Firefox and Safari (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields)

  /**
   * Template API call.
   * "defaults" params are overridden by any user provided params.
   * Create the documentation when create the function, otherwise you'll never
   * get around to it. Copy the official documentation as well.
   */

  /**
   * Calls the [/.../...](https://developers.omniupdate.com) endpoint
   *
   * Description from official documentation.
   *
   * Optional extra info.
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  template(data = {}) {
    let defaults = {};
    return this.call({
      type: '',
      endpoint: '',
    }, {...defaults, ...data});
  }

  // ========== /activity ==========

  /**
   * Calls the [/activity/list](https://developers.omniupdate.com/#!/Activity/get_activity_list) endpoint
   *
   * Lists a page of recently performed actions for a site. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  activity_list(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/activity/list',
    }, {...defaults, ...data});
  }

  // ========== /assets ==========

  /**
   * Calls the [/assets/list](https://developers.omniupdate.com/#!/Assets/get_assets_list) endpoint
   *
   * List a page of assets. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  assets_list(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/assets/list',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/assets/view](https://developers.omniupdate.com/#!/Assets/get_assets_view) endpoint
   *
   * View an asset. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  assets_view(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/assets/view',
    }, {...defaults, ...data});
  }

  // ========== /components ==========

  /**
   * Calls the [/rs/components/dependents/{type}/{name}](https://developers.omniupdate.com/#!/Components/getDependents) endpoint
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  components_dependents(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: `/rs/components/dependents/${data.type}/${data.name}`,
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/rs/components/{type}/{name}](https://developers.omniupdate.com/#!/Components/read_2) endpoint
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  components_get(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: `/rs/components/${data.type}/${data.name}`,
    }, {...defaults,});
    // }, {...defaults, ...data});
  }

  /**
   * Calls the [/rs/components](https://developers.omniupdate.com/#!/Components/list_2) endpoint
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  components_list(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: '/rs/components',
    }, {...defaults, ...data});
  }

  // ========== /directories ==========

  /**
   * Calls the [/directories/settings](https://developers.omniupdate.com/#!/Directories/get_directories_settings) endpoint
   *
   * Get directory settings. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  directories_settings(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: '/directories/settings',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/directories/tag_settings](https://developers.omniupdate.com/#!/Directories/get_directories_tag_settings) endpoint
   *
   * Get directory tag settings. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  directories_tag_settings(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: '/directories/tag_settings',
    }, {...defaults, ...data});
  }

  // ========== /files ==========

  /**
   * Calls the [/files/checkin](https://developers.omniupdate.com/#!/Files/post_files_checkin) endpoint
   *
   * Checkin a file. (Level 9+ or have group access)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_checkin(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'POST',
      endpoint: '/files/checkin',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/checkout](https://developers.omniupdate.com/#!/Files/post_files_checkout) endpoint
   *
   * Checkout a file. (Level 9+ or have group access)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_checkout(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'POST',
      endpoint: '/files/checkout',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/filter_by_tags](https://developers.omniupdate.com/#!/Files/get_files_filter_by_tags) endpoint
   *
   * Returns a list of pages and directories that match the specified tags and exist under the specified directory path. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_filter_by_tags(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/filter_by_tags',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/list](https://developers.omniupdate.com/#!/Files/get_files_list) endpoint.
   *
   * Returns a list of files for a specified directory or .pcf path. (All user
   * levels)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_list(data = {}) {
    let defaults = {
      access_filter: true,
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/list',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/log](https://developers.omniupdate.com/#!/Files/get_files_log) endpoint.
   *
   * Get file log info for a specified file. (All user levels)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_log(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/log',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/products](https://developers.omniupdate.com/#!/Files/get_files_products) endpoint.
   *
   * Get page products. (All user levels)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_products(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/products',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/publish](https://developers.omniupdate.com/#!/Files/post_files_publish) endpoint.
   *
   * Publish a file. (Level 9+ or group access)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_publish(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'POST',
      endpoint: '/files/publish',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/properties](https://developers.omniupdate.com/#!/Files/get_files_properties) endpoint.
   *
   * Get page properties. (Level 9+ or level 5+ with group access)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_properties(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/properties',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/save](https://developers.omniupdate.com/#!/Files/post_files_save) endpoint.
   *
   * Save files. (Level 9+ or 1+ with group access)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_save(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'POST',
      endpoint: '/files/save',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/subscribers](https://developers.omniupdate.com/#!/Files/get_files_subscribers) endpoint.
   *
   * Get page products. (All user levels)Returns a list of files that are subscribers to a specified file. (All user levels)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_subscribers(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/subscribers',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/versions](https://developers.omniupdate.com/#!/Files/get_files_versions) endpoint.
   *
   * Returns a list of versions for a specified file. (Level 9+ or have group
   * access)
   *
   * @param {Object} data Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_versions(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/versions',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/files/view](https://developers.omniupdate.com/#!/Files/get_files_view) endpoint
   *
   * View a file. (Level 9+ or have group access)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  files_view(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/files/view',
    }, {...defaults, ...data});
  }

  // ========== /groups ==========

  /**
   * Calls the [/groups/list](https://developers.omniupdate.com/#!/Groups/get_groups_list) endpoint
   *
   * Returns a list of group information. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  groups_list(data = {}) {
    let defaults = {
      count: 100000,
    };
    return this.call({
      type: 'GET',
      endpoint: '/groups/list',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/groups/view](https://developers.omniupdate.com/#!/Groups/get_groups_view) endpoint
   *
   * Returns group information for the specified group. (Level 10+ only)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  groups_view(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: '/groups/view',
    }, {...defaults, ...data});
  }

  // ========== /metadata ==========

  metadata_list(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/metadata/list',
    }, {...defaults, ...data});
  }

  metadata_new(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'POST',
      endpoint: '/metadata/list',
    }, {...defaults, ...data});
  }

  // ========== /reports ==========

  /**
   * Calls the [/reports](https://developers.omniupdate.com/#!/Reports/get_reports) endpoint
   *
   * Custom reports. (Level 9+ only)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  custom_report(data = {}) {
    let defaults = {
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/reports',
    }, {...defaults, ...data});
  }

  // ========== /sites ==========

  /**
   * Calls the [/sites/findreplace](https://developers.omniupdate.com/#!/Sites/post_sites_findreplace) endpoint
   *
   * Start a find and replace job. (Level 10+ only)
   *
   * When searching for multiple things, use paths instead of path, i.e. paths: ['/index.pcf']
   *
   * @param data {Object} Parameters for the API call.
   * @param callback {function} Optional callback function to run when find and replace job is finished.
   * @returns {*} Response from the Omni CMS API.
   */
  find_replace(data = {}, callback) {
    let meta = {
      type: 'POST',
      endpoint: '/sites/findreplace',
    };
    let defaults = {
      casesensitive: false,
      site: this.site,
      // path: '/',
      // extensions: 'pcf',
    };
    if (callback) {
      this.call(meta, {...defaults, ...data}).then(r => {
        let interval = setInterval(() => {
          this.find_replace_status({
            site: data.site,
            id: r.id,
          }).then(r => {
            if (r.finished === true) {
              clearInterval(interval);
              callback(r);
            }
          });
        }, 500);
      });
    } else return this.call(meta, {...defaults, ...data});
  }

  /**
   * Calls the [/sites/findreplacestatus](https://developers.omniupdate.com/#!/Sites/get_sites_findreplacestatus) endpoint
   *
   * Returns find and replace status for a specified find and replace job. (Level 10+ only and must the owner of the find and replace job)
   *
   * Runs automatically if a callback function was provided to api.find_replace().
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  find_replace_status(data = {}) {
    let defaults = {};
    return this.call({
      type: 'GET',
      endpoint: '/sites/findreplacestatus',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/sites/list](https://developers.omniupdate.com/#!/Sites/get_sites_list) endpoint
   *
   * Returns a list of sites for an account. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  sites_list(data = {}) {
    let defaults = {
      account: this.account,
    };
    return this.call({
      type: 'GET',
      endpoint: '/sites/list',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/sites/view](https://developers.omniupdate.com/#!/Sites/get_sites_view) endpoint
   *
   * Returns site information for the specified site. (Level 10+ only)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  sites_view(data = {}) {
    let defaults = {
      account: this.account,
      site: this.site,
    };
    return this.call({
      type: 'GET',
      endpoint: '/sites/view',
    }, {...defaults, ...data});
  }

  // ========== /tag ==========

  /**
   * Calls the [/tag/list](https://developers.omniupdate.com/#!/Tag/get_tag_list) endpoint
   *
   * Fetch a list of tags. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  tag_list(data = {}) {
    let defaults = {
      count: 100000,
    };
    return this.call({
      type: 'GET',
      endpoint: '/tag/list',
    }, {...defaults, ...data});
  }

  // ========== /users ==========

  /**
   * Calls the [/users/list](https://developers.omniupdate.com/#!/Users/get_users_list) endpoint
   *
   * Returns a list of user information. (All user levels)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  users_list(data = {}) {
    let defaults = {
      count: 10000,
    };
    return this.call({
      type: 'GET',
      endpoint: '/users/list',
    }, {...defaults, ...data});
  }

  /**
   * Calls the [/users/me](https://developers.omniupdate.com/#!/Users/get_users_me) endpoint
   *
   * Returns user information for a specified gadget authorization token. (Level 10+ only)
   *
   * @param data {Object} Parameters for the API call.
   * @returns {*} Response from the Omni CMS API.
   */
  users_me(data = {}) {
    let defaults = {
      account: this.account,
    };
    return this.call({
      type: 'GET',
      endpoint: '/users/me',
    }, {...defaults, ...data});
  }
}
