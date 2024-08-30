import express from "express";

import * as fs from "fs";
import * as path from "path";

const app = express();
const port = 3000;
const state = new EntryStore()

import { EntryStore } from './state'
import { pngToRbxImage } from "./png";

function start_watch_folder(
    folderPath: string,
    handlers?: {
        created?: (filename: string) => void,
        removed?: (filename: string) => void,
        changed?: (filename: string) => void
    },
    filter?: (filename: string, stats: fs.Stats) => boolean
) {
    /*
        kinds of events
        - created - file added to folder
            - exists - file that exists on watch start
                > for now we will just use created for this
        - renamed - moved/renamed within folder
            > for now we will ignore this and just handle it a a remove+create
        - removed - deleted/moved out of folder
        - changed - content modified
    */
    const default_handler = () => { };
    const default_filter = () => {
        return true;
    };

    handlers = handlers == undefined ? {} : handlers
    const created_handler =
        handlers.created == undefined ? default_handler : handlers.created;
    const removed_handler =
        handlers.removed == undefined ? default_handler : handlers.removed;
    const changed_handler =
        handlers.changed == undefined ? default_handler : handlers.changed;

    const filter_fn = filter == undefined ? default_filter : filter;

    let allowed_files = new Set();

    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error(err);
            return;
        }
        files.forEach((filename) => {
            const filepath = path.join(folderPath, filename);
            fs.stat(filepath, (err, stats) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (!filter_fn(filename, stats)) return;
                created_handler(filename);
                allowed_files.add(filename);
            });
        });
    });

    fs.watch(folderPath, { persistent: true }, (eventType, filename) => {
        if (filename) {
            const filepath = path.join(folderPath, filename);

            fs.stat(filepath, (err, stats) => {
                if (err) {
                    if (err.code === "ENOENT" && allowed_files.has(filename)) {
                        removed_handler(filename);
                        allowed_files.delete(filename)
                    }
                    else {
                        console.error(err);
                    }
                    return;
                }
                else {
                    if (!filter_fn(filename, stats)) return;
                    if (eventType === "change") {
                        changed_handler(filename);
                    } else {
                        if (allowed_files.has(filename)) {
                            changed_handler(filename)
                        } else {
                            created_handler(filename);
                            allowed_files.add(filename)
                        }
                    }
                }
            });
        }
    });
};

function start_server() {
    // auto json the things
    app.use(express.json());

    // read from server
    app.get("/getUpdates", (_req, res) => {
        let updates = state.getModifiedEntries()
        state.clearModifiedFlags()

        res.status(200);
        res.send({ updates: updates });
    });

    app.get("/getAll", (_req, res) => {
        let entries = state.getEntries()

        res.status(200);
        res.send({ updates: entries });
    });

    app.listen(port, () => {
        console.log(`listening on port ${port}`);
    });
}

async function main() {
    const watch_path = process.argv[2] || process.cwd();

    let known_files = new Map<string, number>();

    function create_or_update(name: string, type: string, data: any) {
        let id = known_files.get(name)
        if (id !== undefined) {
            state.updateEntry(id, data)
        } else {
            let id = state.addEntry(type, name, data)
            known_files.set(name, id)
        }
    }

    async function png_handler(filename: string) {
        let data = await pngToRbxImage(path.join(watch_path, filename))
        create_or_update(filename, 'png', data)
    }

    async function obj_handler(filename: string) {
        const data = fs.readFileSync(path.join(watch_path, filename), 'utf-8');
        create_or_update(filename, 'obj', data)
    }

    start_watch_folder(
        watch_path,
        {
            created: async (filename) => {
                if (filename.endsWith('.png'))
                    png_handler(filename)
                if (filename.endsWith('.obj'))
                    obj_handler(filename)
            },
            changed: async (filename) => {
                if (filename.endsWith('.png'))
                    png_handler(filename)
                if (filename.endsWith('.obj'))
                    obj_handler(filename)
            },
            removed: (filename) => {
                console.log(`removed: ${filename}`)
                // do nothing here for now
            },
        },
        (filename, stats) => {
            let is_png = filename.endsWith('.png')
            let is_obj = filename.endsWith('.obj')
            return (is_png || is_obj) && !stats.isDirectory()
        },
    );

    start_server();
}

main();
