# @spin/project

The project: where it is, whether it is a spin project, what its build
configuration declares, the theme files it holds, and the icons it has saved.

A project is a directory with a claim on it — a `spin/` directory of theme
documents, and a build configuration that says how the app is put together. The
operations over that directory live here, and only here: a module that owns its
facts owns the operations over them, so the daemon that serves a project asks
this package rather than keeping its own answer.

## Exports

```
@spin/project
  facts        PROJECT_DIR · ICONS_DIR · CONFIG_FILENAME · initFiles · isWired

  service      detectProject · currentProject · initProject · readConfiguration
               listThemes · readTheme · writeTheme · removeTheme · copyTheme
               projectService          (the same operations, as one surface)

  icons        listIcons · readIcon · writeIcon · removeIcon

  reading      configurationIn · shortcutsIn · contentIn · mountIn

  types        ProjectReport · ProjectTheme · ProjectIcon · IconAttribution
               SavedIcon · ProjectConfiguration · InitProjectOptions · WriteResult
```

## The operations

Every operation takes the root it is about. Nothing here reads a global, and
nothing here is bound to a root: one process can serve many projects, and a
project is a place on disk that the caller names.

| Operation                      | What it answers                                                     |
| ------------------------------ | ------------------------------------------------------------------- |
| `detectProject(root)`          | what a root holds: is it a spin project, is it wired, what themes   |
| `currentProject(root)`         | the same report, for the root a host serves                         |
| `initProject(...)`             | makes one: the themes directory, a first theme, a wired config      |
| `readConfiguration(root)`      | the Uno options the project's configuration declares                |
| `listThemes(root)`             | the project's themes: its files, and the starters it has not forked |
| `readTheme(root, name)`        | one theme's text, from the project or from the shipped set          |
| `writeTheme(root, name, text)` | writes one theme file, creating the directory if it is new          |
| `removeTheme(root, name)`      | takes one theme file away                                           |
| `copyTheme(root, from, to)`    | copies one theme to a new name, refusing a name that is taken       |
| `listIcons(root)`              | the icons the project has saved, by name                            |
| `readIcon(root, name)`         | one saved icon: its markup and where it came from                   |
| `writeIcon(root, name, icon)`  | saves one icon, creating the library's drawer if it is new          |
| `removeIcon(root, name)`       | takes one saved icon away                                           |

`detectProject` and `currentProject` are one walk: they differ only in which
root they examine, so the notions of "has spin", "has uno" and "is wired" cannot
drift apart. The daemon's `current` is that walk over the root the daemon was
started with.

## The saved icons

A saved icon is a name, the markup that draws it, and where it came from. The
attribution — the collection, its author, its licence — is recordable but
optional: an icon the project drew itself has no collection behind it.

The files live in the project's own directory, under a name of their own:
`spin/icons/<name>.json`, beside the themes and not among them. The document is
the icon:

```json
{
  "markup": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" …>",
  "attribution": {
    "collection": "lucide",
    "author": "Lucide Contributors",
    "license": "ISC"
  }
}
```

A name is a file stem, like a theme's: a name the file system will not take is
refused rather than tidied, because a tidied name would file the icon under a
name its author did not choose.

## The configuration

A build configuration is a MODULE: it imports its bundler, its plugins and its
icon catalogues — none of which a reader can load, and a reader that tried would
run a build to answer a question about a class name. So the declaration is read
as TEXT.

What it declares is the project's own vocabulary and reach:

- `shortcuts` — each name, and the classes it expands to.
- `content` — the globs the project scans.
- `mount` — the app the configuration mounts, as the configuration names it.

Reading is best-effort and says so. `unreadable` means the configuration
declares something this could not read — a shortcuts table kept in another
module, a glob the configuration computes rather than writes. A vocabulary it
could not read is one it must not enforce.

## The facts

`PROJECT_DIR` is `spin`: the mark of a project, and a name no dependency takes.
`isWired(text)` says whether a configuration applies spin — both entry points
count, the encapsulated one (`@spin/config`, `spin()`) and the raw one
(`@spin/preset`, `spinPreset()`). `initFiles(options)` is what `init` writes:
the theme document the theme package makes, and the config the preset makes.

## The disk

This module reads and writes the filesystem, and it is the only one that does: a
package that is not this one must not reach for `node:fs` to learn where a
project's files are. That is how the migration is proved — the daemon's project
procedures hold no filesystem code at all.

The filesystem is reached through dynamic imports: the daemon's client is
bundled for the browser, and a `node:` import at the top of this module would
follow it into a bundle that must never touch a disk.

## Development

```
deno task test     # the operations, over a real directory
```
