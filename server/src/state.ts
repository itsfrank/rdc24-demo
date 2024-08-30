class Entry {
    id: number;
    type: string;
    name: string;
    data: any;
    modified: boolean;

    constructor(id: number, data: any, type: string, name: string) {
        this.id = id;
        this.data = data;
        this.type = type;
        this.name = name;
        this.modified = true; // from nothing to somthing!
    }
}

export class EntryStore {
    private entries: Map<number, Entry> = new Map();
    private listeners: Array<() => void> = [];

    private generateId(): number {
        let id;
        do {
            id = Math.floor(1000 + Math.random() * 9000); // 4 digit ids, for any real workflow, cheap/low-chance of collision, easy to copy/type
        } while (this.entries.has(id));
        return id;
    }

    addEntry(type: string, name: string, data: any): number {
        const id = this.generateId();
        this.entries.set(id, new Entry(id, data, type, name));
        this.listeners.forEach(fn => fn())
        return id;
    }

    updateEntry(id: number, newData: any): void {
        const entry = this.entries.get(id);
        if (entry) {
            entry.data = newData;
            entry.modified = true;
        }

        this.listeners.forEach(fn => fn())
    }

    getEntry(id: number): Entry | undefined {
        return this.entries.get(id)
    }

    getModifiedEntries(): Entry[] {
        return Array.from(this.entries.values()).filter(entry => entry.modified);
    }

    getEntries(): Entry[] {
        return Array.from(this.entries.values())
    }

    clearModifiedFlags(): void {
        this.entries.forEach(entry => entry.modified = false);
    }

    onUpdate(fn: () => void): { disconnect: () => void } {
        this.listeners.push(fn)
        return {
            disconnect: () => {
                let index = this.listeners.indexOf(fn)
                if (index !== -1) {
                    this.listeners.splice(index, 1)
                }
            }
        }
    }
}
