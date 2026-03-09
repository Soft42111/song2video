import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'sogni-vid-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export interface ProjectRecord {
    id: string;
    type: 'song-video' | 'video';
    prompt: string;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    audioUrl?: string; // Original URL
    videoUrl?: string; // Original URL
    localVideoBlob?: Blob; // Locally stored blob
    localAudioBlob?: Blob; // Locally stored blob
    timestamp: number;
    step?: string;
    error?: string;
    logs?: string[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp');
                }
            },
        });
    }
    return dbPromise;
}

export const db = {
    async saveProject(project: ProjectRecord) {
        const db = await getDB();
        await db.put(STORE_NAME, project);
    },

    async getProject(id: string): Promise<ProjectRecord | undefined> {
        const db = await getDB();
        return db.get(STORE_NAME, id);
    },

    async getAllProjects(): Promise<ProjectRecord[]> {
        const db = await getDB();
        const projects = await db.getAllFromIndex(STORE_NAME, 'timestamp');
        return projects.reverse(); // Newest first
    },

    async deleteProject(id: string) {
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    },

    async updateProject(id: string, updates: Partial<ProjectRecord>) {
        const db = await getDB();
        const project = await db.get(STORE_NAME, id);
        if (project) {
            await db.put(STORE_NAME, { ...project, ...updates });
        }
    },

    async persistMedia(id: string, url: string, type: 'video' | 'audio') {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const updates = type === 'video' ? { localVideoBlob: blob } : { localAudioBlob: blob };
            await this.updateProject(id, updates);
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error('Failed to persist media locally', e);
            return url;
        }
    }
};
