# USU Gadgets for Evolve 2022
_The Power of Omni CMS Gadgets: Making Life Easier for Your Content Editors (And Yourself)_

These are (most) of the gadgets that we presented for the Evolve 2022 conference. Feel free to download them and use them yourself!

### A couple of things to note:

- The following gadgets were shown but require some bug fixes/polish before we can release them; they'll be in this repo soon™
    - [ ] Multi-Site Search
    - [x] ~~User Manager~~
        - The ability to lock/unlock users doesn't currently work, though the bug has been filed by the Omni CMS developers as bug OX-15322.
- The `z_clone` folder is the gadget template. It's what I copy/paste whenever I'm creating a new gadget.
- The `gadgetlib.js` included in this repo has a single line modified that's used by our gadgets; the gadgets included in this repo require this change. All I've done is add a function call at line 280.
- The following changes should be made to the files before you use them (you can quickly find all these items by searching for "TODO EVOLVE" in the files):
    - All the `index.html` files have a spot for a support email, set this to something relevant for you/your team
    - `omni-api.js`
        - This file also has a spot for the support email
        - This file has fallback settings for `gadget.account` in the constructor
    - Every `config.xml` file has two spots to put the absolute URL for the `icon.svg` for each gadget

---

## How to Download

1. Click on the green "Code" button on the top right
2. Choose "Download ZIP"

---

## Useful Links

- Gadget Documentation: [https://support.moderncampus.com/learn-omni-cms/gadgets/](https://support.moderncampus.com/learn-omni-cms/gadgets/)
- Gadget API Documentation: [https://developers.omniupdate.com](https://developers.omniupdate.com/)
- Official Gadget Starter Code: [https://github.com/omniupdate/gadget-starter](https://github.com/omniupdate/gadget-starter)
- "Building a Custom Gadget" YouTube Tutorial: [https://youtu.be/anESt1Pmw7c](https://youtu.be/anESt1Pmw7c)

---

## Support

If you have any questions, concerns, bug reports, funny jokes, declarations of war, etc., feel free to either email me at [mark.snyder@usu.edu](mailto:mark.snyder@usu.edu) or file an issue on this repo. This is _not_ our main repo for our gadgets, so I can't promise regular updates. Unless there are serious bugs (which could be possible as I had to make a few modifications to make these ready for public release), I will definitely try to remember to push the changes here as well.
