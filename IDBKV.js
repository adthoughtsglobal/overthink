class IDBKV {
    constructor(dbName = 'AppDB', storeName = 'kv', version = 1) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;
        this.db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return this.db;
    }

    async set(key, value) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).put({ key, value });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async get(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readonly')
                .objectStore(this.storeName)
                .get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => reject(req.error);
        });
    }

    async has(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readonly')
                .objectStore(this.storeName)
                .getKey(key);
            req.onsuccess = () => resolve(req.result !== undefined);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readwrite')
                .objectStore(this.storeName)
                .delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getAll() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readonly')
                .objectStore(this.storeName)
                .getAll();
            req.onsuccess = () => {
                const out = {};
                for (const { key, value } of req.result) out[key] = value;
                resolve(out);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async keys() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readonly')
                .objectStore(this.storeName)
                .getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async clear() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction(this.storeName, 'readwrite')
                .objectStore(this.storeName)
                .clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    static async deleteAllDatabases() {
        const dbs = indexedDB.databases ? await indexedDB.databases() : [];
        await Promise.all(
            dbs.map(info =>
                new Promise((resolve, reject) => {
                    const req = indexedDB.deleteDatabase(info.name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                    req.onblocked = () => reject(new Error('blocked'));
                })
            )
        );
    }
}