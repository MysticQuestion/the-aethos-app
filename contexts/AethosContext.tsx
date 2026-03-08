import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NatalChart,
  TransitEvent,
  ThemeScores,
  generateNatalChart,
  generateTransitEvents,
  generateThemeScores,
  getDailyCosmicWeather,
} from "@/lib/astrology";

const STORAGE_KEY = "aethos_birth_data";
const JOURNAL_KEY = "aethos_journal";

export interface BirthData {
  name: string;
  birthDate: string;
  birthHour: number;
  birthMinute: number;
  birthCity: string;
  geoLat?: number;
  geoLon?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  focus: number;
  connection: number;
  decisionConfidence: number;
  note: string;
}

interface AethosContextValue {
  birthData: BirthData | null;
  chart: NatalChart | null;
  transitEvents: TransitEvent[];
  themeScores: ThemeScores | null;
  cosmicWeather: ReturnType<typeof getDailyCosmicWeather> | null;
  journalEntries: JournalEntry[];
  todayEntry: JournalEntry | null;
  isOnboarded: boolean;
  isLoading: boolean;
  saveBirthData: (data: BirthData) => Promise<void>;
  saveJournalEntry: (entry: Omit<JournalEntry, "id" | "date">) => Promise<void>;
  getTransitById: (id: string) => TransitEvent | undefined;
  resetAll: () => Promise<void>;
}

const AethosContext = createContext<AethosContextValue | null>(null);

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function AethosProvider({ children }: { children: ReactNode }) {
  const [birthData, setBirthData] = useState<BirthData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [bdRaw, jRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(JOURNAL_KEY),
      ]);
      if (bdRaw) setBirthData(JSON.parse(bdRaw));
      if (jRaw) setJournalEntries(JSON.parse(jRaw));
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveBirthData(data: BirthData) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setBirthData(data);
  }

  async function saveJournalEntry(entry: Omit<JournalEntry, "id" | "date">) {
    const today = todayKey();
    const existing = journalEntries.find(e => e.date === today);
    const newEntry: JournalEntry = {
      ...entry,
      id: existing?.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: today,
    };

    const updated = journalEntries.filter(e => e.date !== today).concat(newEntry);
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(updated));
    setJournalEntries(updated);
  }

  function getTransitById(id: string): TransitEvent | undefined {
    return transitEvents.find(e => e.id === id);
  }

  async function resetAll() {
    await AsyncStorage.multiRemove([STORAGE_KEY, JOURNAL_KEY]);
    setBirthData(null);
    setJournalEntries([]);
  }

  const chart = useMemo(() => {
    if (!birthData) return null;
    try {
      const date = new Date(birthData.birthDate + "T12:00:00Z");
      const fractionalHour = birthData.birthHour + (birthData.birthMinute || 0) / 60;
      const geoLat = birthData.geoLat ?? 0;
      const geoLon = birthData.geoLon ?? 0;
      return generateNatalChart(date, fractionalHour, geoLat, geoLon);
    } catch (e) {
      console.error("Chart generation failed:", e);
      return null;
    }
  }, [birthData]);

  const transitEvents = useMemo(() => {
    if (!chart) return [];
    return generateTransitEvents(chart, new Date(), 10);
  }, [chart]);

  const themeScores = useMemo(() => {
    if (!chart) return null;
    return generateThemeScores(chart, new Date());
  }, [chart]);

  const cosmicWeather = useMemo(() => {
    return getDailyCosmicWeather(new Date());
  }, []);

  const todayEntry = useMemo(() => {
    return journalEntries.find(e => e.date === todayKey()) || null;
  }, [journalEntries]);

  const value = useMemo(() => ({
    birthData,
    chart,
    transitEvents,
    themeScores,
    cosmicWeather,
    journalEntries,
    todayEntry,
    isOnboarded: !!birthData,
    isLoading,
    saveBirthData,
    saveJournalEntry,
    getTransitById,
    resetAll,
  }), [birthData, chart, transitEvents, themeScores, cosmicWeather, journalEntries, todayEntry, isLoading]);

  return <AethosContext.Provider value={value}>{children}</AethosContext.Provider>;
}

export function useAethos() {
  const ctx = useContext(AethosContext);
  if (!ctx) throw new Error("useAethos must be used within AethosProvider");
  return ctx;
}
