/**
 * @author Mark Snyder
 * @copyright Copyright 2019-2022 Utah State University
 */

// TODO: when getting an approver by username, double check that the approver still exists, otherwise it crashes
// TODO LOCKED: Currently, the /rs/users/USERNAME/locked endpoint doesn't work for custom gadgets.
//  Once this has been fixed, changes can be made here and in the index.html file to implement the user locking feature.
//  Search for TODO LOCKED to find places where changes need to happen
//  It has been filed as bug OX-15322 for the Omni dev team

/*
User Access Level Defaults

9 - Source Code
9 - Overwrite
8 - Delete
6 - Upload
 */

const REG_DATE = /.*?[0-9]\/.*?[0-9]\/[0-9]{2}/i;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let api, gadgetModal;

let userDB, userDB_OG, filtered, userGroups;
let currentUser;

let slider_filter, slider_user;
let $user_groups;
let selected;

$(() => {

  gadget.ready().then(gadget.fetch).then(() => {

    init().then(() => {

      document.querySelector('#loading').style.display = 'none';
      document.querySelector('#main').style.display = 'flex';
      document.querySelector('#gadget-toolbar-container').style.display = '';

    });
  });
});

// ========== INIT ==========

function init() {

  gadgetModal = new GadgetModal();

  api = new OmniAPI({
    debug: false,
    logging: false,
    modal: gadgetModal,
    name: 'user_manager',
  });

  slider_filter = document.querySelector('#filter-lvl-slider');
  slider_user = document.querySelector('#user-lvl-slider');

  $user_groups = $('#user-groups');

  for (let slider of [slider_filter, slider_user]) {

    noUiSlider.create(slider, {
      start: slider === slider_user ? 0 : [0, 10],
      behaviour: 'snap',
      connect: slider === slider_user ? [true, false] : true,
      format: wNumb({
        decimals: 0,
      }),
      step: 1,
      range: {
        'min': [0],
        'max': [10],
      },
      // tooltips: [wNumb({decimals: 0}), wNumb({decimals: 0})],
      pips: {
        mode: 'count',
        values: 11,
        density: 10,
      },
    });
  }

  for (let element of document.querySelectorAll('.pre-init')) {
    element.setAttribute('disabled', 'true');
    for (let handle of document.querySelectorAll('.noUi-origin'))
      handle.setAttribute('disabled', 'true');
  }

  let currentMonth = new Date().getMonth() + 1;
  let currentYear = new Date().getFullYear();
  let startDate = (currentMonth !== 12 ? currentMonth + 1 : 1) + '/' + (currentMonth !== 12 ? currentYear : currentMonth + 1);

  $('.date-picker').datepicker({
    autoclose: true,
    clearBtn: true,
    endDate: startDate,
    minViewMode: 1, // months
    format: 'M yyyy',
    startDate: 'Jan 1999',
    // setDate: "Mar 2017",
    // todayBtn: true,
    // defaultViewDate: "today",
  }).on('changeDate', (selected) => {
    runFilter();
  });

  return populateDropdown().then(() => {
    $user_groups.selectpicker();
    document.querySelectorAll('.bootstrap-select')[0].getElementsByTagName('button')[0].disabled = true;
  });
}

/**
 * Populates the dropdown with the list of available user groups.
 * @returns {Promise} Used to finish setting up the gadget after the items have been added.
 */
function populateDropdown() {

  return api.groups_list().then(list => {

    list = sortObjs(list, 'name');
    userGroups = list;
    let frag = document.createDocumentFragment();

    for (let userGroup of list) {
      let option = document.createElement('option');
      option.innerText = userGroup.name;
      option.value = userGroup.name;
      frag.appendChild(option);

    }

    document.querySelector('#user-groups').appendChild(frag);
    return Promise.resolve();
  });
}

// ========== RUN ==========

/**
 * Resets variables, fetches the users from the server, builds the database, displays the users, and enables the GUI.
 */
function run() {

  userDB = [];
  userDB_OG = [];
  filtered = [];
  currentUser = {};
  selected = false;

  let proms = [];

  document.querySelector('#init-button').style.display = 'none';
  document.querySelector('#init-loading').style.display = 'block';

  api.users_list().then(r => {

    document.querySelector('#init-text').innerText = 'Users Fetched: ';
    document.querySelector('#init-count').innerText = userDB_OG.length.toString() + '/' + r.length.toString();

    for (let userInfo of r) {
      proms.push(
        api.users_view({ user: userInfo.username }).then(user => {
          return api.users_groups({ user: userInfo.username }).then(groups => {
            user.groups = groups.groups;

            userDB_OG.push(minUserInfo(user));
            userDB.push(minUserInfo(user));
            document.querySelector('#init-count').innerText = userDB_OG.length.toString() + '/' + r.length.toString();
          });
        }),
      );
    }

    Promise.all(proms).then(() => {
      userDB = sortObjs(userDB, 'last_name');

      document.querySelector('#init').style.display = 'none';
      document.querySelector('#list-buttons').style.display = 'block';

      slider_filter.removeAttribute('disabled');
      slider_user.removeAttribute('disabled');

      for (let handle of document.querySelectorAll('.noUi-origin'))
        handle.removeAttribute('disabled');

      document.querySelectorAll('.bootstrap-select')[0].getElementsByTagName('button')[0].removeAttribute('disabled');

      for (let element of document.querySelectorAll('.pre-init')) {
        element.removeAttribute('disabled');

        setTimeout(() => {
          element.classList.remove('pre-init');
        }, 0);
      }

      addListeners();

      let frag = document.createDocumentFragment();

      // needed to trigger after default onclick event
      setTimeout(() => {

        for (let user of userDB) {
          frag.appendChild(cloneListItem(user));
        }

        prepareCSV();
        runFilter();
        document.querySelector('#csv-export').classList.remove('disabled');

        document.querySelector('#filter-count').innerText = userDB.length.toString();
        document.querySelector('#user-list').innerHTML = '';
        document.querySelector('#user-list').append(frag);

        $('[data-toggle="tooltip"]').tooltip();
      }, 0);
    });
  });
}

/**
 * Creates a user with only the necessary info from the API.
 * @param {Object} user The new user.
 */
function minUserInfo(user) {
  let cleanUser = {};

  // cleanUser.modified = false;
  cleanUser.submitted = false;
  cleanUser.deleted = false;

  // main info
  cleanUser.username = user.username; // A#
  cleanUser.privilege = user.privilege; // 0-10
  cleanUser.first_name = user.first_name;
  cleanUser.last_name = user.last_name;
  cleanUser.full_name = user.first_name + ' ' + user.last_name;
  cleanUser.email = user.email;
  cleanUser.phone = user.phone;

  // booleans
  cleanUser.allow_delete = user.allow_delete;
  cleanUser.allow_overwrite = user.allow_overwrite;
  cleanUser.allow_source = user.allow_source;
  cleanUser.allow_upload = user.allow_upload;
  cleanUser.locked = user.locked;

  // dates
  d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  cleanUser.date_created = REG_DATE.exec(user.created_format)[0];
  cleanUser.days_since_created = dateDiff(Date.parse(cleanUser.date_created), d);
  if (user.last_login_format !== '') {
    cleanUser.date_login = REG_DATE.exec(user.last_login_format)[0];
    cleanUser.days_since_login = dateDiff(Date.parse(cleanUser.date_login), d);
  } else {
    cleanUser.date_login = 'Never';
    cleanUser.days_since_login = 999999;
  }

  // groups
  cleanUser.groups = user.groups;
  let index = cleanUser.groups.indexOf('Everyone');

  // other info
  cleanUser.save_count = user.save_count;
  cleanUser.approver = user.approver;
  cleanUser.enforce_approver = user.enforce_approver;

  if (index > -1) {
    cleanUser.groups.splice(index, 1);
  }

  return cleanUser;
}

/**
 * Calculates the difference between two dates by days.
 * @param {number} first The start date.
 * @param {number} second The end date.
 * @returns {number} The number of calculated days.
 */
function dateDiff(first, second) {
  return Math.round((second - first) / (86400000)); // 86400000 = (1000 * 60 * 60 * 24)
}

/**
 * Adds event listeners to all interactable elements to update the app.
 */
function addListeners() {

  for (let element of document.querySelectorAll('.trigger-filter')) {
    element.addEventListener('click', runFilter);
  }

  for (let element of document.querySelectorAll('.trigger-filter-input')) {
    element.addEventListener('input', runFilter);
  }

  for (let element of document.querySelectorAll('.trigger-sort')) {
    element.addEventListener('change', sortList);
  }

  slider_filter.noUiSlider.on('set', runFilter);
  slider_user.noUiSlider.on('set', updateUserInfo);

  for (let element of document.querySelectorAll('.trigger-user')) {
    element.addEventListener('click', updateUserInfo);
  }

  $user_groups.on('changed.bs.select', (e, clickedIndex, isSelected, previousValue) => {
    // $user_groups.val("");
    // $("#user-groups option:selected").prependTo("#user-groups");
    // $user_groups.selectpicker("refresh");
    // $user_groups.selectpicker("render");

    updateUserInfo();
  });
}

/**
 * Clones the template list item and gives it the new user info.
 * @param {Object} user The user to be displayed in the list item.
 * @returns {Node} The cloned and updated HTML element.
 */
function cloneListItem(user) {
  let clone = document.querySelector('#clone-li').cloneNode(true);

  clone.id = 'li-' + user.username;

  clone.querySelectorAll('.li-name')[0].innerText = user.full_name;
  clone.querySelectorAll('.li-username')[0].innerText = user.username;
  clone.querySelectorAll('.li-lvl')[0].innerText = 'Access Level: ' + user.privilege;
  clone.dataset.username = user.username;

  clone.querySelectorAll('.li-date')[0].innerText = 'Last Login: ' + user.date_login;

  if (user === currentUser) clone.classList.add('alert-primary');

  clone.addEventListener('click', () => {
    displayUser(user);
    clone.classList.add('alert-primary');
  });

  return clone;
}


// ========== FILTERING ==========

/**
 * Starts the process to filter the users based on user criteria and update the GUI accordingly.
 */
function runFilter() {

  setTimeout(() => {
    filterUsers();

    for (let user of userDB) {

      let node = document.querySelector('#li-' + user.username);

      if (filtered.includes(user)) node.style.display = 'flex';
      else node.style.display = 'none';
    }

    document.querySelector('#filter-count').innerText = filtered.length.toString();

    selectAll(false);
  }, 0);
}

/**
 * Gets all filter options from the GUI and creates a list of users that the filter applies to.
 */
function filterUsers() {

  let lvl_min = parseInt(slider_filter.noUiSlider.get()[0]);
  let lvl_max = parseInt(slider_filter.noUiSlider.get()[1]);

  let date_login = Date.parse($('#months-login').datepicker('getDate'));
  let date_created = Date.parse($('#months-created').datepicker('getDate'));

  // before/after
  let ba_login = document.querySelector('#filter-login').options[document.querySelector('#filter-login').selectedIndex].value;
  let ba_created = document.querySelector('#filter-created').options[document.querySelector('#filter-created').selectedIndex].value;

  // let admin = document.querySelector('#filter-checkbox-was-admin').checked;
  // let exclude_admin = document.querySelector('#filter-checkbox-exclude-admin').checked;
  let approver = document.querySelector('#filter-checkbox-approver').checked;
  let email = document.querySelector('#filter-checkbox-no-email').checked;
  let never_logged = document.querySelector('#filter-checkbox-never-logged').checked;
  let no_groups = document.querySelector('#filter-checkbox-no-groups').checked;
  let source = document.querySelector('#filter-checkbox-source').checked;
  let locked = document.querySelector('#filter-checkbox-locked').checked;
  let modified = document.querySelector('#filter-checkbox-modified').checked;
  let submitted = document.querySelector('#filter-checkbox-submitted').checked;
  let deleted = document.querySelector('#filter-checkbox-deleted').checked;

  // document.querySelector('#filter-checkbox-was-admin').disabled = exclude_admin;
  // document.querySelector('#filter-checkbox-exclude-admin').disabled = admin;

  filtered = [];

  for (let user of userDB) {

    if (document.querySelector('#filter-name').value !== ''
      && !(user.full_name.toLowerCase().includes(document.querySelector('#filter-name').value.toLowerCase())
        || user.username.toLowerCase().includes(document.querySelector('#filter-name').value.toLowerCase())
      )) continue;

    if (!(user.privilege >= lvl_min) || !(user.privilege <= lvl_max)) continue;

    if (!isNaN(date_login) && ba_login === 'after' && !(Date.parse(user.date_login) > date_login)) continue;
    else if (!isNaN(date_login) && ba_login === 'before' && !(Date.parse(user.date_login) < date_login)) continue;
    if (!isNaN(date_created) && ba_created === 'after' && !(Date.parse(user.date_created) > date_created)) continue;
    else if (!isNaN(date_created) && ba_created === 'before' && !(Date.parse(user.date_created) < date_created)) continue;

    // if (admin && !user.full_name.includes('*')) continue;
    // if (exclude_admin && user.full_name.includes('*')) continue;
    if (approver && !user.enforce_approver) continue;
    if (email && user.email !== '') continue;
    if (never_logged && user.date_login !== 'Never') continue;
    if (no_groups && user.groups.length !== 0) continue;
    if (source && !user.allow_source) continue;
    if (locked && !user.locked) continue;
    if (modified && !isModified(user)) continue;
    if (submitted && !user.submitted) continue;
    if (deleted && !user.deleted) continue;

    // if this statement is reached, the user has passed the filter checks.
    filtered.push(user);
  }
}

/**
 * Resets all filter options in the GUI, runs the filter, and updates the list of users.
 */
function resetFilter() {
  document.querySelector('#filter-name').value = '';

  slider_filter.noUiSlider.set([0, 10]);

  document.querySelector('#filter-login').options[0].selected = 'selected';
  document.querySelector('#filter-created').options[0].selected = 'selected';

  Date.parse($('#months-login').datepicker('update', ''));
  Date.parse($('#months-created').datepicker('update', ''));

  // document.querySelector('#filter-checkbox-was-admin').checked = false;
  // document.querySelector('#filter-checkbox-exclude-admin').checked = false;
  document.querySelector('#filter-checkbox-approver').checked = false;
  document.querySelector('#filter-checkbox-no-email').checked = false;
  document.querySelector('#filter-checkbox-never-logged').checked = false;
  document.querySelector('#filter-checkbox-no-groups').checked = false;
  document.querySelector('#filter-checkbox-source').checked = false;
  document.querySelector('#filter-checkbox-locked').checked = false;
  document.querySelector('#filter-checkbox-modified').checked = false;
  document.querySelector('#filter-checkbox-submitted').checked = false;
  document.querySelector('#filter-checkbox-deleted').checked = false;

  runFilter();
}


/**
 * Sorts the list of filtered users based off of the GUI dropdown.
 */
function sortList() {

  setTimeout(() => {

    switch (document.querySelector('#sort').options[document.querySelector('#sort').selectedIndex].value) {
      case 'a-z':
        userDB = sortObjs(userDB, 'last_name');
        break;
      case 'z-a':
        userDB = sortObjs(userDB, 'last_name').reverse();
        break;
      case 'login':
        userDB = sortObjs(userDB, 'last_name').reverse();
        userDB = sortObjs(userDB, 'days_since_login').reverse();
        break;
      case 'login_d':
        userDB = sortObjs(userDB, 'days_since_login');
        break;
      case 'created':
        userDB = sortObjs(userDB, 'last_name').reverse();
        userDB = sortObjs(userDB, 'days_since_created').reverse();
        break;
      case 'created_d':
        userDB = sortObjs(userDB, 'days_since_created');
        break;
      case 'level':
        userDB = sortObjs(userDB, 'privilege');
        break;
      case 'level_d':
        userDB = sortObjs(userDB, 'last_name').reverse();
        userDB = sortObjs(userDB, 'privilege').reverse();
        break;
      default:
        return;

    }

    let byCreated = document.querySelector('#sort').options[document.querySelector('#sort').selectedIndex].value.includes('created');

    for (let user of userDB) {

      let node = document.querySelector('#li-' + user.username);

      if (byCreated) node.querySelectorAll('.li-date')[0].innerText = 'Date Created: ' + user.date_created;
      else node.querySelectorAll('.li-date')[0].innerText = 'Last Login: ' + user.date_login;

      node.parentNode.appendChild(node);

    }
  }, 0);
}


// ========== USER LIST ==========

/**
 * Selects all of the currently filtered users and changes the GUI to use the multi-user panel instead of the single-user panel.
 * @param {boolean} allAreSelected Whether or not the all currently filtered users are selected. Defaults to the inverse of the current state to act as a toggle.
 */
function selectAll(allAreSelected = !selected) {

  selected = allAreSelected;

  for (let user of filtered) {
    updateListItem(user);
  }

  if (selected) {
    document.querySelector('#select-all').innerText = 'Deselect All';
    document.querySelector('#select-all').classList.remove('btn-outline-success');
    document.querySelector('#select-all').classList.add('btn-outline-danger');

    document.querySelector('#single-user-panel').style.display = 'none';
    document.querySelector('#multi-user-panel').style.display = 'block';

    resetMultiUserButtons();
  } else {
    document.querySelector('#select-all').innerText = 'Select All';
    document.querySelector('#select-all').classList.remove('btn-outline-danger');
    document.querySelector('#select-all').classList.add('btn-outline-success');

    document.querySelector('#single-user-panel').style.display = 'block';
    document.querySelector('#multi-user-panel').style.display = 'none';

    displayUser(currentUser);
  }
}

/**
 * Updates the list item for a given user to reflect the current state of user selection.
 * @param {Object} user The user whose list item should be updated.
 */
function updateListItem(user) {

  // should try to fix this function at some point

  // don't remove try catch block plz
  try {

    let userNode = document.querySelector('#li-' + user.username);
    // let userNode = document.getElementById('li-' + user.username);

    userNode.querySelectorAll('.li-lvl')[0].innerText = 'Access Level: ' + user.privilege;
    // userNode.getElementsByClassName('li-lvl')[0].innerText = 'Access Level: ' + user.privilege;

    userNode.classList.remove('alert-primary');
    userNode.classList.remove('alert-success');
    userNode.classList.remove('alert-warning');

    if (user.deleted) userNode.classList.add('alert-danger');
    else if (selected) userNode.classList.add('alert-primary');
    else if (isModified(user)) userNode.classList.add('alert-warning');
    else if (user.submitted) userNode.classList.add('alert-success');
  } catch (e) {
    console.log(e, user);
  }
}


// ========== USER INFO ==========

/**
 * Displays the currently selected user's info.
 * @param {Object} user The user whose information will be displayed.
 */
function displayUser(user) {

  if (Object.entries(user).length !== 0) {

    updateListItem(currentUser);
    currentUser = user;
    document.querySelector('#li-' + currentUser.username).classList.add('alert-primary');
    document.querySelector('#li-' + currentUser.username).classList.remove('alert-success');
    document.querySelector('#li-' + currentUser.username).classList.remove('alert-warning');

    document.querySelector('#user-delete').disabled = false;
    document.querySelector('#user-purge').disabled = false;

    userButtons();

    if (currentUser.first_name !== '' && currentUser.last_name !== '') document.querySelector('#user-full-name').innerText = currentUser.full_name;
    else document.querySelector('#user-full-name').innerText = 'n/a';
    if (currentUser.username !== '') document.querySelector('#user-username').innerText = currentUser.username;
    else document.querySelector('#user-username').innerText = 'n/a';

    document.querySelector('#user-login-date').innerText = 'Last Login: ' + currentUser.date_login;
    document.querySelector('#user-login-days').innerText = (currentUser.days_since_login === 999999 ? 'n/a' : currentUser.days_since_login + (currentUser.days_since_login === 1 ? ' day ago' : ' days ago'));
    document.querySelector('#user-created-date').innerText = 'Date Created: ' + currentUser.date_created;
    document.querySelector('#user-created-days').innerText = currentUser.days_since_created + (currentUser.days_since_created === 1 ? ' day ago' : ' days ago');
    document.querySelector('#user-saves').innerText = 'Total Saves: ' + currentUser.save_count;
    document.querySelector('#user-saves-days').innerText = (currentUser.days_since_login === 999999 ? '0' : Math.round((currentUser.save_count / (currentUser.days_since_login - currentUser.days_since_created)) * -10) / 10) + ' saves/day';
    document.querySelector('#user-email').innerText = 'E-mail: ' + (currentUser.email !== '' ? currentUser.email : 'n/a');
    document.querySelector('#user-approver').innerText = 'Approver: ' + (user.enforce_approver ? getUser(currentUser.approver).full_name : 'n/a');

    slider_user.noUiSlider.set(currentUser.privilege);

    document.querySelector('#user-checkbox-source').checked = currentUser.allow_source;
    document.querySelector('#user-checkbox-overwrite').checked = currentUser.allow_overwrite;
    document.querySelector('#user-checkbox-delete').checked = currentUser.allow_delete;
    document.querySelector('#user-checkbox-upload').checked = currentUser.allow_upload;
    document.querySelector('#user-checkbox-locked').checked = currentUser.locked;

    $user_groups.selectpicker('deselectAll');
    $user_groups.selectpicker('val', currentUser.groups);
  }
}

/**
 * Updates the currently selected user's info in the database based off of changes made in the GUI.
 */
function updateUserInfo() {

  // needed to trigger after default onclick event
  setTimeout(() => {

    for (let user of [currentUser]) {

      user.privilege = parseInt(slider_user.noUiSlider.get());

      user.allow_delete = document.querySelector('#user-checkbox-delete').checked;
      user.allow_overwrite = document.querySelector('#user-checkbox-overwrite').checked;
      user.allow_source = document.querySelector('#user-checkbox-source').checked;
      user.allow_upload = document.querySelector('#user-checkbox-upload').checked;
      user.locked = document.querySelector('#user-checkbox-locked').checked;

      user.groups = $user_groups.val();

      document.querySelector('#li-' + user.username).querySelectorAll('.li-lvl')[0].innerText = 'Access Level: ' + user.privilege;

    }

    userButtons();
  }, 0);
}

/**
 * Enables/disables the buttons on the user panel depending on whether or not the currently selected user has been modified.
 */
function userButtons() {
  if (isModified(currentUser)) {
    document.querySelector('#user-revert').disabled = false;
    document.querySelector('#user-submit').disabled = false;
  } else {
    document.querySelector('#user-revert').disabled = true;
    document.querySelector('#user-submit').disabled = true;
  }
}

/**
 * Updates the delete user modal with the user information and disables the confirmation button for a couple of seconds.
 */
function triggerDelete() {
  document.querySelector('#delete-modal-label').innerText = 'Delete User for ' + currentUser.full_name;
  document.querySelector('#confirm-delete').disabled = true;

  setTimeout(() => {
    document.querySelector('#confirm-delete').disabled = false;
  }, 2500);

}

/**
 * Deletes the currently selected user.
 */
function deleteSubmit() {

  api.users_delete({ user: currentUser.username }).then(() => {
    currentUser.deleted = true; // normal DB
    currentUser = getUser(currentUser.username, true);
    currentUser.deleted = true; // OG DB
    document.querySelector('#li-' + currentUser.username).onclick = null;

    if (!selected) displayUser(currentUser);
    else updateListItem(currentUser);
    userButtons();
  });

  // deleteUser(currentUser.username)
  //   .done(() => {
  //
  //   })
  //   .fail(() => {
  //     $('#fail-modal').modal();
  //   });
}

/**
 * "Purges" a given user. A purged user has all permissions revoked, is removed from all groups, and is set to level 0.
 * @param {Object} targetUser The user to purge.
 */
function purge(targetUser = currentUser) {
  targetUser.submitted = false;

  targetUser.privilege = 0;

  targetUser.allow_delete = false;
  targetUser.allow_overwrite = false;
  targetUser.allow_source = false;
  targetUser.allow_upload = false;
  targetUser.locked = true;
  targetUser.groups = [];

  if (!selected) displayUser(targetUser);
  else updateListItem(targetUser);
  userButtons();
}

/**
 * Reverts any changes made to a given user.
 * @param {Object} targetUser The user to revert.
 */
function revert(targetUser = currentUser) {
  let original = getUser(targetUser.username, true);

  targetUser.privilege = original.privilege;

  targetUser.allow_delete = original.allow_delete;
  targetUser.allow_overwrite = original.allow_overwrite;
  targetUser.allow_source = original.allow_source;
  targetUser.allow_upload = original.allow_upload;
  targetUser.locked = original.locked;
  targetUser.groups = original.groups;

  if (!selected) displayUser(targetUser);
  else updateListItem(targetUser);
  userButtons();
}

/**
 * Submits the updated user to the server.
 * @param {Object} targetUser The user to submit.
 */
function submit(targetUser = currentUser) {

  // TODO LOCKED: use this endpoint once the bug has been fixed preventing locking of users from custom gadgets: /rs/users/USERNAME/locked

  // api.users_locked({
  //   username: targetUser.username,
  //   locked: targetUser.locked,
  // });

  api.users_save({
    user: targetUser.username,
    privilege: targetUser.privilege,
    allow_delete: targetUser.allow_delete,
    allow_overwrite: targetUser.allow_overwrite,
    allow_source: targetUser.allow_source,
    allow_upload: targetUser.allow_upload,
    locked: targetUser.locked,
  }).then(() => {

      targetUser.submitted = true;

      let groups_og = getUser(targetUser.username, true).groups;

      for (let i = 0; i < groups_og.length; i++) {
        if (!targetUser.groups.includes(groups_og[i])) {
          console.log('Removed from group:' + groups_og[i]);
          api.groups_remove({
            group: groups_og[i],
            user: targetUser.username,
          });
          // removeFromGroup(targetUser.username, groups_og[i]);
        }
      }

      for (let i = 0; i < targetUser.groups.length; i++) {
        if (!groups_og.includes(targetUser.groups[i])) {
          console.log('Added to group:' + targetUser.groups[i]);
          api.groups_add({
            group: targetUser.groups[i],
            user: targetUser.username,
          });
          // addToGroup(targetUser.username, targetUser.groups[i]);
        }
      }

      for (let i = 0; i < userDB_OG.length; i++) {
        if (userDB_OG[i].username === targetUser.username) {

          userDB_OG[i].privilege = targetUser.privilege;

          userDB_OG[i].allow_delete = targetUser.allow_delete;
          userDB_OG[i].allow_overwrite = targetUser.allow_overwrite;
          userDB_OG[i].allow_source = targetUser.allow_source;
          userDB_OG[i].allow_upload = targetUser.allow_upload;
          userDB_OG[i].locked = targetUser.locked;
          userDB_OG[i].groups = targetUser.groups;
          break;
        }
      }

      if (!selected) displayUser(targetUser);
      else updateListItem(targetUser);
      userButtons();

      $('#submit-modal').modal();
    });
    // .fail(() => {
    //   $('#fail-modal').modal();
    // });
}


// ========== MULTI-USER OPERATIONS ==========

/**
 * Modifies currently selected users by a passed function.
 * @param {function} func The function to be ran on the users.
 */
function multiUserModifyByFunc(func) {

  for (let user of filtered) {
    if (!user.deleted) func(user);
  }

  if (func !== setLevelZero && func !== setNoGroups) resetMultiUserButtons(func === purge);
  displayUser(currentUser);
}

/**
 * Modify a specific key/value pair for all currently selected users.
 * @param {String} key The key to update.
 * @param {String|Number|boolean} val The updated value.
 */
function multiUserModifyVal(key, val) {

  for (let user of filtered) {
    user[key] = val;
  }

  document.querySelector('#multi-user-' + key + '-' + val).classList.remove('btn-outline-secondary');
  document.querySelector('#multi-user-' + key + '-' + val).classList.add('btn-outline-' + (val ? 'success' : 'danger'));
  document.querySelector('#multi-user-' + key + '-' + !val).classList.add('btn-outline-secondary');
  document.querySelector('#multi-user-' + key + '-' + !val).classList.remove('btn-outline-' + (!val ? 'success' : 'danger'));

  displayUser(currentUser);
}

/**
 * Removes a user from all their groups. Put in a function to be passable to multiUserModifyFunc().
 * @param {Object} user The user to be modified.
 */
function setNoGroups(user) {
  user.groups = [];
}

/**
 * Sets a user's level to 0. Put in a function to be passable to multiUserModifyFunc().
 * @param {Object} user The user to be modified.
 */
function setLevelZero(user) {
  user.privilege = 0;
  document.querySelector('#li-' + user.username).querySelectorAll('.li-lvl')[0].innerText = 'Access Level: 0';
}

/**
 * Updates the classes on a given button to reflect the current state of the button.
 * @param {String} id The id of the button to update.
 */
function updateMultiUserButton(id) {
  document.getElementById(id).classList.add('btn-outline-danger');
  document.getElementById(id).classList.remove('btn-outline-secondary');
}

/**
 * Resets the multi-user buttons to their default state.
 * @param {boolean} purge If true, some buttons are set to their red state.
 */
function resetMultiUserButtons(purge = false) {
  for (let element of document.querySelectorAll('.multi-user')) {
    if (purge && element.id.includes('false')) {
      element.classList.add('btn-outline-danger');
      element.classList.remove('btn-outline-secondary');
    } else {
      element.classList.remove('btn-outline-success', 'btn-outline-danger');
      element.classList.add('btn-outline-secondary');
    }
  }
}


// ========== MISC ==========

/**
 * Checks if a user has been modified.
 * @param {Object} user The user to check.
 * @returns {boolean} Whether or not the user has been modified.
 */
function isModified(user) {
  let user_og = getUser(user.username, true);

  if (user.privilege !== user_og.privilege) return true;

  if (user.allow_delete !== user_og.allow_delete) return true;
  if (user.allow_overwrite !== user_og.allow_overwrite) return true;
  if (user.allow_source !== user_og.allow_source) return true;
  if (user.allow_upload !== user_og.allow_upload) return true;
  if (user.locked !== user_og.locked) return true;
  if (user.groups.length !== user_og.groups.length) return true;

  let groupsA = user.groups.sort();
  let groupsB = user_og.groups.sort();

  for (let i = 0; i < user.groups.length; i++) {
    if (!groupsA[i].includes(groupsB[i])) return true;
  }

  return false;
}

/**
 * Returns a given user from the user database.
 * @param {String} username The username of the user to return.
 * @param {boolean} og If true, returns the original, unmodified user.
 * @return {Object} The user from the database.
 */
function getUser(username, og = false) {
  for (let user of og ? userDB_OG : userDB) {
    if (user.username === username) {
      return user;
    }
  }
}

/**
 * Prepares the CSV to be created and downloaded.
 */
function prepareCSV() {

  let final = [
    ['Count: ' + filtered.length.toString()],
    [''],
    ['Applied Filters'],
  ];
  if (document.querySelector('#filter-name').value !== '') final.push(['Name/Username contains: ' + document.querySelector('#filter-name').value]);
  final.push(['Min Level: ' + parseInt(slider_filter.noUiSlider.get()[0])]);
  final.push(['Max Level: ' + parseInt(slider_filter.noUiSlider.get()[1])]);
  if (!isNaN(Date.parse($('#months-login').datepicker('getDate')))) {
    let date = new Date(Date.parse($('#months-login').datepicker('getDate')));
    final.push(['Login ' + document.querySelector('#filter-login').options[document.querySelector('#filter-login').selectedIndex].value + ' ' + MONTH_NAMES[date.getMonth()] + ' ' + date.getFullYear()]);
  }
  if (!isNaN(Date.parse($('#months-created').datepicker('getDate')))) {
    let date = new Date(Date.parse($('#months-created').datepicker('getDate')));
    final.push(['Created ' + document.querySelector('#filter-created').options[document.querySelector('#filter-created').selectedIndex].value + ' ' + MONTH_NAMES[date.getMonth()] + ' ' + date.getFullYear()]);
  }

  // if (document.querySelector('#filter-checkbox-was-admin').checked) final.push(['Was an admin']);
  // if (document.querySelector('#filter-checkbox-exclude-admin').checked) final.push(['Wasn\'t an admin']);
  if (document.querySelector('#filter-checkbox-approver').checked) final.push(['Has an approver']);
  if (document.querySelector('#filter-checkbox-no-email').checked) final.push(['Has no email']);
  if (document.querySelector('#filter-checkbox-never-logged').checked) final.push(['Never logged in']);
  if (document.querySelector('#filter-checkbox-no-groups').checked) final.push(['Isn\'t in any groups']);
  if (document.querySelector('#filter-checkbox-source').checked) final.push(['Has source code']);
  if (document.querySelector('#filter-checkbox-locked').checked) final.push(['Is locked']);
  if (document.querySelector('#filter-checkbox-modified').checked) final.push(['Has been modified']);
  if (document.querySelector('#filter-checkbox-submitted').checked) final.push(['Has been submitted']);


  final.push(['']);
  final.push(['Level', 'Full Name', 'Username', 'Last Login', 'Date Created', 'Save Count', 'E-mail', 'Approver', 'Has Source', 'Has Overwrite', 'Allow Delete', 'Allow Upload', 'Is Locked', 'Access Groups']);

  for (let user of filtered) {
    let groups = '';
    for (let group of user.groups) {
      groups += group + ', ';
    }
    groups = '"' + groups.slice(0, -2) + '"';

    final.push([
      user.privilege.toString(),
      user.full_name,
      user.username,
      user.date_login,
      // user.days_since_login.toString(),
      user.date_created,
      // user.days_since_created.toString(),
      user.save_count.toString(),
      user.email,
      (user.enforce_approver && user.approver ? getUser(user.approver).full_name : ''),
      user.allow_source.toString(),
      user.allow_overwrite.toString(),
      user.allow_delete.toString(),
      user.allow_upload.toString(),
      user.locked.toString(),
      groups,
    ]);
  }

  buildCSV({
    array: final,
    filename: 'user_manager',
    includeDate: true,
    includeSite: false,
  });
}
