// hooks/visits.tsx
import { VisitRecord, isSamePlace, normalizePlaceName } from "@/constants/visit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "VISITS_V1";

type Candidate = {
  lat: number;
  lng: number;
  placeName: string;
  note: string;
  visitedAt: string; // ISO string
  placeId?: string;
};

type VisitsContextType = {
  visits: VisitRecord[];
  loading: boolean;

  upsertCandidate: (c: Candidate) => { matched?: VisitRecord; candidate: Candidate };
  mergeVisit: (existingId: string, c: Candidate) => Promise<void>;
  createVisit: (c: Candidate) => Promise<void>;
  removeAll: () => Promise<void>;
};

const VisitsContext = createContext<VisitsContextType | null>(null);

function toISOFromLocalInput(localLike: string) {
  // AddVisitModal에서 "YYYY-MM-DDTHH:mm" 형태로 들어오면 로컬 기준으로 Date 생성 후 ISO 저장
  // 이미 ISO라면 그대로 통과
  if (!localLike) return new Date().toISOString();
  if (localLike.includes("Z")) return localLike;
  const d = new Date(localLike);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function VisitsProvider({ children }: { children: React.ReactNode }) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setVisits(JSON.parse(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(next: VisitRecord[]) {
    setVisits(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const api = useMemo<VisitsContextType>(() => {
    return {
      visits,
      loading,

      upsertCandidate: (c) => {
        const candidate = { ...c, visitedAt: toISOFromLocalInput(c.visitedAt) };

        // “같은 장소” 후보 찾기 (가장 먼저 매칭되는 것 1개)
        const matched = visits.find((v) =>
          isSamePlace(
            v,
            { lat: candidate.lat, lng: candidate.lng, placeId: candidate.placeId, placeName: candidate.placeName },
            50,
            0.86
          )
        );

        return { matched, candidate };
      },

      mergeVisit: async (existingId, c) => {
        const iso = toISOFromLocalInput(c.visitedAt);
        const now = new Date().toISOString();

        const next = visits.map((v) => {
          if (v.id !== existingId) return v;

          const nextDates = [...v.visitDates, iso].sort(); // 보기 좋게 정렬(선택)
          return {
            ...v,
            // placeName은 기존 유지(원하면 최신값으로 교체해도 됨)
            note: c.note?.trim() ? c.note : v.note,
            visitDates: nextDates,
            visitCount: nextDates.length,
            updatedAt: now,
          };
        });

        await persist(next);
      },

      createVisit: async (c) => {
        const now = new Date().toISOString();
        const iso = toISOFromLocalInput(c.visitedAt);

        const rec: VisitRecord = {
          id: newId(),
          placeId: c.placeId,
          placeName: c.placeName,
          lat: c.lat,
          lng: c.lng,
          note: c.note ?? "",
          visitDates: [iso],
          visitCount: 1,
          createdAt: now,
          updatedAt: now,
          normalizedName: normalizePlaceName(c.placeName),
        };

        await persist([rec, ...visits]);
      },

      removeAll: async () => {
        await persist([]);
      },
    };
  }, [visits, loading]);

  return <VisitsContext.Provider value={api}>{children}</VisitsContext.Provider>;
}

export function useVisits() {
  const ctx = useContext(VisitsContext);
  if (!ctx) throw new Error("useVisits must be used within VisitsProvider");
  return ctx;
}
