/**
 * Avatar group examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A stack of faces is a `.avatar-group` of face markup the author already
 * writes: each child after the first is pulled back over the one before it,
 * and the last one is on top. The counter that closes a long stack is a plain
 * span — it inherits the ring from the group's own child selector rather than
 * a class of its own, because "how many more" is content, not a component.
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface AvatarGroupExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

const img = (classes: string, src: string, alt: string): string =>
  `<img class="${classes}" src="${src}" alt="${alt}">`;

export const avatarGroupFixtureNote =
  "A stack of faces, later ones on top: an .avatar-group of the avatars an " +
  "author already writes, each child after the first pulled back a third of " +
  "a face so they overlap instead of butting. The ring around every child " +
  "is what separates the front face from the one behind it, and it comes from " +
  "the group, so a circle group gets a circular ring without being asked. A " +
  "counter for the rest of the stack is a plain span in the same ring. alt is " +
  "required: the face is content, and without alt it is invisible to " +
  "assistive tech.";

export const AVATAR_GROUP_EXAMPLES: readonly AvatarGroupExample[] = [
  {
    name: "Stacked",
    html: row(
      `          <div class="avatar-group">
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMjU2M2ViIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkdIPC90ZXh0Pjwvc3ZnPg==",
          "Grace Hopper",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjNmQyOGQ5Ii8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFMPC90ZXh0Pjwvc3ZnPg==",
          "Ada Lovelace",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMGY3NjZlIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFUPC90ZXh0Pjwvc3ZnPg==",
          "Alan Turing",
        )
      }
          </div>`,
    ),
  },
  {
    name: "A counter for the rest",
    html: row(
      `          <div class="avatar-group">
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMjU2M2ViIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkdIPC90ZXh0Pjwvc3ZnPg==",
          "Grace Hopper",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjNmQyOGQ5Ii8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFMPC90ZXh0Pjwvc3ZnPg==",
          "Ada Lovelace",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMGY3NjZlIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFUPC90ZXh0Pjwvc3ZnPg==",
          "Alan Turing",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjYjQ1MzA5Ii8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPktKPC90ZXh0Pjwvc3ZnPg==",
          "Katherine Johnson",
        )
      }
            ${
        img(
          "avatar avatar-sm",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjYmUxODVkIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPlJQPC90ZXh0Pjwvc3ZnPg==",
          "Radia Perlman",
        )
      }
            <span>+3</span>
          </div>`,
    ),
  },
  {
    name: "Circles",
    html: row(
      `          <div class="avatar-group">
            ${
        img(
          "avatar avatar-circle avatar-md",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjNmQyOGQ5Ii8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFMPC90ZXh0Pjwvc3ZnPg==",
          "Ada Lovelace",
        )
      }
            ${
        img(
          "avatar avatar-circle avatar-md",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMjU2M2ViIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkdIPC90ZXh0Pjwvc3ZnPg==",
          "Grace Hopper",
        )
      }
            ${
        img(
          "avatar avatar-circle avatar-md",
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMGY3NjZlIi8+PHRleHQgeD0iNDgiIHk9IjYwIiBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmZmZmYiPkFUPC90ZXh0Pjwvc3ZnPg==",
          "Alan Turing",
        )
      }
          </div>`,
    ),
  },
];
