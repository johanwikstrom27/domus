"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Unit = "st" | "kg" | "g" | "l" | "dl" | "ml" | "pkt" | "burk";

type Recurrence =
  | { type: "once" }
  | { type: "weekly"; weekday: number }
  | { type: "biweekly"; weekday: number }
  | { type: "monthly"; mode: "date" | "last"; day?: number }
  | { type: "yearly" }
  | { type: "custom"; interval: number; unit: "day" | "week" | "month" };

interface User {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  createdAt: number;
}

interface InviteToken {
  token: string;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
  usedBy?: string;
  usedAt?: number;
}

interface Household {
  id: string;
  name: string;
  memberIds: string[];
  invites: InviteToken[];
  createdAt: number;
  createdBy?: string;
}

interface Dwelling {
  id: string;
  householdId: string;
  name: string;
  icon: string;
  accentColor?: string;
  createdAt: number;
}

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  defaultQuantity: number;
  defaultUnit: Unit;
  units: Unit[];
}

interface LearningRecord {
  id: string;
  dwellingId: string;
  catalogItemId: string;
  quantity: number;
  unit: Unit;
  updatedAt: number;
}

interface ShoppingItem {
  id: string;
  householdId: string;
  dwellingId: string;
  shoppingListId: string;
  catalogItemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: Unit;
  checked: boolean;
  checkedAt?: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

interface PresetItem {
  catalogItemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: Unit;
}

interface ShoppingList {
  id: string;
  householdId: string;
  dwellingId: string;
  name: string;
  createdAt: number;
  createdBy: string;
  archivedAt?: number;
}

interface Preset {
  id: string;
  householdId: string;
  dwellingId: string;
  name: string;
  items: PresetItem[];
  createdAt: number;
  createdBy: string;
}

interface RecipeIngredient {
  catalogItemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: Unit;
}

interface Recipe {
  id: string;
  householdId?: string;
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  imageDataUrl?: string;
}

interface Todo {
  id: string;
  householdId: string;
  dwellingId?: string;
  title: string;
  note?: string;
  dueDate?: string;
  assignee: "none" | "all" | string;
  status: "active" | "done";
  recurrence: Recurrence;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  updatedBy: string;
}

interface UserSetting {
  id: string;
  userId: string;
  dailySummaryEnabled: boolean;
  lastSummaryDate?: string;
  categoryOverrides?: Record<string, string>;
}

interface CategoryOrder {
  id: string;
  dwellingId: string;
  categories: string[];
  updatedAt: number;
}

type ActivityType =
  | "shopping_list_created"
  | "shopping_completed"
  | "todo_created"
  | "todo_completed"
  | "recipe_created"
  | "legacy";

interface ActivityItem {
  id: string;
  type: ActivityType;
  householdId: string;
  dwellingId?: string;
  message: string;
  createdAt: number;
}

interface DomusDB {
  users: User[];
  households: Household[];
  dwellings: Dwelling[];
  catalog: CatalogItem[];
  shoppingLists: ShoppingList[];
  learning: LearningRecord[];
  shopping: ShoppingItem[];
  presets: Preset[];
  recipes: Recipe[];
  todos: Todo[];
  settings: UserSetting[];
  categoryOrders: CategoryOrder[];
  activity: ActivityItem[];
  meta: {
    updatedAt: number;
  };
}

interface SessionState {
  currentUserId: string | null;
  activeHouseholdId: string | null;
  activeDwellingId: string | null;
}

interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

interface PendingNewProduct {
  name: string;
  quantity: number;
  unit: Unit;
  category: string;
  shoppingListId: string;
}

interface PendingNewList {
  name: string;
  pendingInput?: string;
}

interface CatalogDefaultDraft {
  quantity: string;
  unit: Unit;
}

interface PendingRecipeIngredient {
  name: string;
  quantity: number;
  unit: Unit;
  category: string;
}

interface CloudProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

interface CloudHouseholdRow {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
}

interface CloudMembershipRow {
  household_id: string;
  user_id: string;
  joined_at: string;
}

interface CloudInviteRow {
  token: string;
  household_id: string;
  created_at: string;
  expires_at: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
}

interface CloudStatePayload {
  dwellings?: Dwelling[];
  learning?: LearningRecord[];
  shoppingLists?: ShoppingList[];
  shopping?: ShoppingItem[];
  presets?: Preset[];
  recipes?: Recipe[];
  todos?: Todo[];
  categoryOrders?: CategoryOrder[];
  activity?: ActivityItem[];
  metaUpdatedAt?: number;
}

interface CloudStateRow {
  household_id: string;
  state: CloudStatePayload | null;
  updated_at: string;
  updated_by: string;
}

interface CloudCatalogRow {
  id: string;
  name: string;
  category: string;
  default_quantity: number | string;
  default_unit: Unit;
  units: Unit[] | string[] | null;
}

interface CloudUserSettingRow {
  user_id: string;
  daily_summary_enabled: boolean;
  last_summary_date: string | null;
  category_overrides: Record<string, string> | null;
}

const DB_STORAGE_KEY = "domus_db_v1";
const SESSION_STORAGE_KEY = "domus_session_v1";
const CHANNEL_NAME = "domus_realtime_v1";
const LOGOUT_STORAGE_KEY = "domus_logout_v1";
const CLOUD_TABLES = {
  catalog: "domus_catalog_items",
  households: "domus_households",
  invites: "domus_household_invites",
  members: "domus_household_members",
  profiles: "domus_profiles",
  settings: "domus_user_settings",
  states: "domus_household_states",
} as const;
const CLOUD_ENABLED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const DEFAULT_CATEGORIES = [
  "Toa & Badrum",
  "Kök",
  "Skafferi",
  "Mejeri",
  "Kylvaror",
  "Frukt & grönt",
  "Snacks",
  "Dryck",
];

const SEED_CATALOG: CatalogItem[] = [
  { id: "banana", name: "Banan", category: "Frukt & grönt", defaultQuantity: 6, defaultUnit: "st", units: ["st", "kg"] },
  { id: "apple", name: "Äpple", category: "Frukt & grönt", defaultQuantity: 6, defaultUnit: "st", units: ["st", "kg"] },
  { id: "cucumber", name: "Gurka", category: "Frukt & grönt", defaultQuantity: 1, defaultUnit: "st", units: ["st"] },
  { id: "tomato", name: "Tomat", category: "Frukt & grönt", defaultQuantity: 6, defaultUnit: "st", units: ["st", "kg"] },
  { id: "potato", name: "Potatis", category: "Frukt & grönt", defaultQuantity: 1, defaultUnit: "kg", units: ["kg", "g"] },
  { id: "milk", name: "Mjölk", category: "Mejeri", defaultQuantity: 1, defaultUnit: "l", units: ["l", "dl"] },
  { id: "yoghurt", name: "Yoghurt", category: "Mejeri", defaultQuantity: 1, defaultUnit: "l", units: ["l", "dl"] },
  { id: "butter", name: "Smör", category: "Mejeri", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
  { id: "cheese", name: "Ost", category: "Mejeri", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
  { id: "bread", name: "Bröd", category: "Skafferi", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "st"] },
  { id: "eggs", name: "Ägg", category: "Kylvaror", defaultQuantity: 12, defaultUnit: "st", units: ["st"] },
  { id: "coffee", name: "Kaffe", category: "Skafferi", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
  { id: "rice", name: "Ris", category: "Skafferi", defaultQuantity: 1, defaultUnit: "kg", units: ["kg", "g"] },
  { id: "pasta", name: "Pasta", category: "Skafferi", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
  { id: "flour", name: "Mjöl", category: "Skafferi", defaultQuantity: 1, defaultUnit: "kg", units: ["kg", "g"] },
  { id: "salt", name: "Salt", category: "Skafferi", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt"] },
  { id: "chicken", name: "Kyckling", category: "Kylvaror", defaultQuantity: 600, defaultUnit: "g", units: ["g", "kg", "pkt"] },
  { id: "minced", name: "Köttfärs", category: "Kylvaror", defaultQuantity: 500, defaultUnit: "g", units: ["g", "kg", "pkt"] },
  { id: "salmon", name: "Lax", category: "Kylvaror", defaultQuantity: 500, defaultUnit: "g", units: ["g", "kg", "pkt"] },
  { id: "peas", name: "Ärtor", category: "Kylvaror", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt"] },
  { id: "berries", name: "Bär", category: "Kylvaror", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
  { id: "soap", name: "Handtvål", category: "Toa & Badrum", defaultQuantity: 1, defaultUnit: "st", units: ["st", "ml"] },
  { id: "paper", name: "Toapapper", category: "Toa & Badrum", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt"] },
  { id: "detergent", name: "Tvättmedel", category: "Toa & Badrum", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "ml"] },
  { id: "toothbrush", name: "Tandborste", category: "Toa & Badrum", defaultQuantity: 2, defaultUnit: "st", units: ["st"] },
  { id: "frying-pan", name: "Stekpanna", category: "Kök", defaultQuantity: 1, defaultUnit: "st", units: ["st"] },
  { id: "soda", name: "Mineralvatten", category: "Dryck", defaultQuantity: 6, defaultUnit: "st", units: ["st", "l"] },
  { id: "candy", name: "Godis", category: "Snacks", defaultQuantity: 1, defaultUnit: "pkt", units: ["pkt", "g"] },
];

const LEGACY_RECIPE_IDS = new Set(["pasta-bolognese", "salmon-bowl", "frukostbricka"]);
const RECIPE_LIBRARY: Recipe[] = [];

function normalizeCategoryName(category: string): string {
  const normalized = normalizeText(category);

  if (normalized === "toa & badrum") return "Toa & Badrum";
  if (normalized === "kok") return "Kök";
  if (normalized === "skafferi") return "Skafferi";
  if (normalized === "mejeri") return "Mejeri";
  if (normalized === "kylvaror") return "Kylvaror";
  if (normalized === "frukt & gront") return "Frukt & grönt";
  if (normalized === "snacks") return "Snacks";
  if (normalized === "dryck") return "Dryck";

  // Legacy categories
  if (normalized === "brod & frukost" || normalized === "torrvaror") return "Skafferi";
  if (normalized === "kott & fisk" || normalized === "frys") return "Kylvaror";
  if (normalized === "hygien") return "Toa & Badrum";
  if (normalized === "ovrigt") return "Snacks";

  return DEFAULT_CATEGORIES[0];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    ordered.push(trimmed);
  });

  return ordered;
}

function normalizeCategoryOrder(categories: string[]): string[] {
  const normalized = uniqueStrings(categories.map((category) => normalizeCategoryName(category)));
  DEFAULT_CATEGORIES.forEach((category) => {
    if (!normalized.includes(category)) {
      normalized.push(category);
    }
  });
  return normalized;
}

const DEFAULT_SESSION: SessionState = {
  currentUserId: null,
  activeHouseholdId: null,
  activeDwellingId: null,
};

function createDefaultDb(): DomusDB {
  return {
    users: [],
    households: [],
    dwellings: [],
    catalog: [...SEED_CATALOG],
    shoppingLists: [],
    learning: [],
    shopping: [],
    presets: [],
    recipes: RECIPE_LIBRARY,
    todos: [],
    settings: [],
    categoryOrders: [],
    activity: [],
    meta: {
      updatedAt: Date.now(),
    },
  };
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeDb(raw: DomusDB): DomusDB {
  const persistedRecipes = (raw.recipes ?? []).filter((recipe) => !LEGACY_RECIPE_IDS.has(recipe.id));
  const persistedCatalog = raw.catalog?.length ? raw.catalog : SEED_CATALOG;
  const normalizedCatalog = persistedCatalog.map((item) => ({
    ...item,
    category: normalizeCategoryName(item.category),
  }));
  const persistedShoppingLists = (raw.shoppingLists ?? []).map((list) => ({
    ...list,
    name: list.name?.trim() || "Inköpslista",
    archivedAt: typeof list.archivedAt === "number" ? list.archivedAt : undefined,
  }));
  const generatedListMap = new Map<string, ShoppingList>();
  const findOrCreateLegacyList = (item: ShoppingItem): ShoppingList => {
    const existing = persistedShoppingLists.find((list) => list.dwellingId === item.dwellingId);
    if (existing) {
      return existing;
    }

    const cached = generatedListMap.get(item.dwellingId);
    if (cached) {
      return cached;
    }

    const generated: ShoppingList = {
      id: `legacy-${item.dwellingId}`,
      householdId: item.householdId,
      dwellingId: item.dwellingId,
      name: "Inköpslista",
      createdAt: item.createdAt ?? Date.now(),
      createdBy: item.updatedBy,
    };
    generatedListMap.set(item.dwellingId, generated);
    return generated;
  };
  const normalizedShopping = (raw.shopping ?? []).map((item) => ({
    ...item,
    shoppingListId: (() => {
      const existingId = "shoppingListId" in item ? item.shoppingListId : undefined;
      if (
        existingId &&
        (persistedShoppingLists.some((list) => list.id === existingId) ||
          [...generatedListMap.values()].some((list) => list.id === existingId))
      ) {
        return existingId;
      }

      return findOrCreateLegacyList(item).id;
    })(),
    category: normalizeCategoryName(item.category),
  }));
  const normalizedShoppingLists = [...new Map([...persistedShoppingLists, ...generatedListMap.values()].map((list) => [list.id, list])).values()];
  const normalizedCategoryOrders = (raw.categoryOrders ?? []).map((record) => ({
    ...record,
    categories: normalizeCategoryOrder(record.categories),
  }));
  const normalizedSettings = (raw.settings ?? []).map((setting) => {
    if (!setting.categoryOverrides) {
      return setting;
    }

    const nextOverrides = Object.fromEntries(
      Object.entries(setting.categoryOverrides).map(([catalogItemId, category]) => [
        catalogItemId,
        normalizeCategoryName(category),
      ]),
    );

    return {
      ...setting,
      categoryOverrides: nextOverrides,
    };
  });

  const normalizedActivity = (raw.activity ?? []).map((item) => ({
    ...item,
    type: item.type ?? "legacy",
  }));

  return {
    ...createDefaultDb(),
    ...raw,
    catalog: normalizedCatalog,
    shoppingLists: normalizedShoppingLists,
    shopping: normalizedShopping,
    categoryOrders: normalizedCategoryOrders,
    settings: normalizedSettings,
    recipes: persistedRecipes,
    activity: normalizedActivity,
    meta: {
      updatedAt: raw.meta?.updatedAt ?? Date.now(),
    },
  };
}

function normalizeSession(raw: SessionState): SessionState {
  return {
    ...DEFAULT_SESSION,
    ...raw,
  };
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Date.now();
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function toIsoTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function buildCloudStateForHousehold(db: DomusDB, householdId: string): CloudStatePayload {
  const dwellingIds = new Set(db.dwellings.filter((dwelling) => dwelling.householdId === householdId).map((dwelling) => dwelling.id));
  const recipeSource =
    db.households.length === 1
      ? db.recipes.filter((recipe) => !recipe.householdId || recipe.householdId === householdId)
      : db.recipes.filter((recipe) => recipe.householdId === householdId);

  return {
    dwellings: db.dwellings.filter((dwelling) => dwelling.householdId === householdId),
    learning: db.learning.filter((record) => dwellingIds.has(record.dwellingId)),
    shoppingLists: db.shoppingLists.filter((list) => list.householdId === householdId || dwellingIds.has(list.dwellingId)),
    shopping: db.shopping.filter((item) => item.householdId === householdId || dwellingIds.has(item.dwellingId)),
    presets: db.presets.filter((preset) => preset.householdId === householdId || dwellingIds.has(preset.dwellingId)),
    recipes: recipeSource.map((recipe) => ({ ...recipe, householdId })),
    todos: db.todos.filter((todo) => todo.householdId === householdId),
    categoryOrders: db.categoryOrders.filter((entry) => dwellingIds.has(entry.dwellingId)),
    activity: db.activity.filter((entry) => entry.householdId === householdId),
    metaUpdatedAt: db.meta.updatedAt,
  };
}

function buildDbFromCloudSnapshot(args: {
  catalogRows: CloudCatalogRow[];
  currentUserId: string;
  householdRows: CloudHouseholdRow[];
  inviteRows: CloudInviteRow[];
  membershipRows: CloudMembershipRow[];
  profileRows: CloudProfileRow[];
  settingRow: CloudUserSettingRow | null;
  stateRows: CloudStateRow[];
}): DomusDB {
  const {
    catalogRows,
    currentUserId,
    householdRows,
    inviteRows,
    membershipRows,
    profileRows,
    settingRow,
    stateRows,
  } = args;

  const db = createDefaultDb();
  db.catalog =
    catalogRows.length > 0
      ? catalogRows.map((item) => ({
          id: item.id,
          name: item.name,
          category: normalizeCategoryName(item.category),
          defaultQuantity: Number(item.default_quantity) || 1,
          defaultUnit: item.default_unit,
          units: ((item.units ?? [item.default_unit]) as string[]).filter(Boolean) as Unit[],
        }))
      : [...SEED_CATALOG];

  db.users = profileRows.map((profile) => ({
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    createdAt: toTimestamp(profile.created_at),
  }));

  const invitesByHousehold = new Map<string, InviteToken[]>();
  inviteRows.forEach((invite) => {
    const existing = invitesByHousehold.get(invite.household_id) ?? [];
    existing.push({
      token: invite.token,
      createdAt: toTimestamp(invite.created_at),
      expiresAt: toTimestamp(invite.expires_at),
      createdBy: invite.created_by,
      usedBy: invite.used_by ?? undefined,
      usedAt: invite.used_at ? toTimestamp(invite.used_at) : undefined,
    });
    invitesByHousehold.set(invite.household_id, existing);
  });

  const membersByHousehold = new Map<string, string[]>();
  membershipRows.forEach((membership) => {
    const existing = membersByHousehold.get(membership.household_id) ?? [];
    existing.push(membership.user_id);
    membersByHousehold.set(membership.household_id, uniqueStrings(existing));
  });

  db.households = householdRows.map((household) => ({
    id: household.id,
    name: household.name,
    createdAt: toTimestamp(household.created_at),
    createdBy: household.created_by,
    memberIds: membersByHousehold.get(household.id) ?? [currentUserId],
    invites: (invitesByHousehold.get(household.id) ?? []).sort((a, b) => b.createdAt - a.createdAt),
  }));

  const mergedState = stateRows.reduce<CloudStatePayload>(
    (acc, row) => {
      const payload = row.state ?? {};
      acc.dwellings = [...(acc.dwellings ?? []), ...(payload.dwellings ?? [])];
      acc.learning = [...(acc.learning ?? []), ...(payload.learning ?? [])];
      acc.shoppingLists = [...(acc.shoppingLists ?? []), ...(payload.shoppingLists ?? [])];
      acc.shopping = [...(acc.shopping ?? []), ...(payload.shopping ?? [])];
      acc.presets = [...(acc.presets ?? []), ...(payload.presets ?? [])];
      acc.recipes = [...(acc.recipes ?? []), ...(payload.recipes ?? [])];
      acc.todos = [...(acc.todos ?? []), ...(payload.todos ?? [])];
      acc.categoryOrders = [...(acc.categoryOrders ?? []), ...(payload.categoryOrders ?? [])];
      acc.activity = [...(acc.activity ?? []), ...(payload.activity ?? [])];
      acc.metaUpdatedAt = Math.max(acc.metaUpdatedAt ?? 0, payload.metaUpdatedAt ?? toTimestamp(row.updated_at));
      return acc;
    },
    { metaUpdatedAt: 0 },
  );

  db.dwellings = mergedState.dwellings ?? [];
  db.learning = mergedState.learning ?? [];
  db.shoppingLists = mergedState.shoppingLists ?? [];
  db.shopping = mergedState.shopping ?? [];
  db.presets = mergedState.presets ?? [];
  db.recipes = mergedState.recipes ?? [];
  db.todos = mergedState.todos ?? [];
  db.categoryOrders = mergedState.categoryOrders ?? [];
  db.activity = mergedState.activity ?? [];

  if (settingRow) {
    db.settings = [
      {
        id: settingRow.user_id,
        userId: settingRow.user_id,
        dailySummaryEnabled: settingRow.daily_summary_enabled,
        lastSummaryDate: settingRow.last_summary_date ?? undefined,
        categoryOverrides: settingRow.category_overrides ?? {},
      },
    ];
  }

  db.meta.updatedAt = mergedState.metaUpdatedAt || Date.now();
  return normalizeDb(db);
}

function cloneDb(db: DomusDB): DomusDB {
  return JSON.parse(JSON.stringify(db)) as DomusDB;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function buildUserFromAuth(authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    firstName: String(authUser.user_metadata.first_name ?? authUser.user_metadata.firstName ?? "").trim() || "Domus",
    lastName: String(authUser.user_metadata.last_name ?? authUser.user_metadata.lastName ?? "").trim() || "User",
    createdAt: toTimestamp(authUser.created_at),
  };
}

function isLogoutPending() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(LOGOUT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setLogoutPending(pending: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (pending) {
      window.sessionStorage.setItem(LOGOUT_STORAGE_KEY, "1");
      return;
    }

    window.sessionStorage.removeItem(LOGOUT_STORAGE_KEY);
  } catch {}
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timerId: number | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timerId !== null) {
      window.clearTimeout(timerId);
    }
  }
}

function extractToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/[?&]token=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return trimmed;
}

function formatDate(date: string | undefined): string {
  if (!date) {
    return "Ingen deadline";
  }

  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getLastDayInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getStockholmParts(now: Date): { dateKey: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

function recurrenceLabel(recurrence: Recurrence): string {
  switch (recurrence.type) {
    case "once":
      return "Engång";
    case "weekly":
      return "Varje vecka";
    case "biweekly":
      return "Varannan vecka";
    case "monthly":
      return recurrence.mode === "last" ? "Varje månad (sista dagen)" : "Varje månad";
    case "yearly":
      return "Varje år";
    case "custom":
      return `Var ${recurrence.interval} ${recurrence.unit === "day" ? "dag" : recurrence.unit === "week" ? "vecka" : "månad"}`;
    default:
      return "Engång";
  }
}

function computeNextDueDate(todo: Todo): string {
  const base = parseISODate(todo.dueDate ?? toISODate(new Date()));

  switch (todo.recurrence.type) {
    case "once":
      return toISODate(base);
    case "weekly":
      return toISODate(addDays(base, 7));
    case "biweekly":
      return toISODate(addDays(base, 14));
    case "monthly": {
      if (todo.recurrence.mode === "last") {
        const monthShifted = addMonths(base, 1);
        const lastDay = getLastDayInMonth(monthShifted.getFullYear(), monthShifted.getMonth());
        monthShifted.setDate(lastDay);
        return toISODate(monthShifted);
      }

      return toISODate(addMonths(base, 1));
    }
    case "yearly":
      return toISODate(addMonths(base, 12));
    case "custom": {
      if (todo.recurrence.unit === "day") {
        return toISODate(addDays(base, todo.recurrence.interval));
      }

      if (todo.recurrence.unit === "week") {
        return toISODate(addDays(base, todo.recurrence.interval * 7));
      }

      return toISODate(addMonths(base, todo.recurrence.interval));
    }
    default:
      return toISODate(base);
  }
}

function parseShoppingInput(raw: string): { query: string; quantity?: number } {
  const value = raw.trim();
  if (!value) {
    return { query: "" };
  }

  const match = value.match(/^(.*?)(\d+(?:[\.,]\d+)?)\s*$/);
  if (!match) {
    return { query: value };
  }

  const query = match[1].trim();
  const quantity = Number(match[2].replace(",", "."));

  if (!query || Number.isNaN(quantity)) {
    return { query: value };
  }

  return { query, quantity };
}

function getSuggestions(query: string, catalog: CatalogItem[]): CatalogItem[] {
  if (!query.trim()) {
    return [];
  }

  const normalized = normalizeText(query);
  return catalog.filter((item) => normalizeText(item.name).includes(normalized)).slice(0, 8);
}

function resolveAssigneeLabel(assignee: Todo["assignee"], users: User[]): string {
  if (assignee === "none") {
    return "Ingen";
  }

  if (assignee === "all") {
    return "Alla";
  }

  return users.find((user) => user.id === assignee)?.firstName ?? "Okänd";
}

function resolveTodoSummary(todo: Todo, todayKey: string): "today" | "overdue" | null {
  if (!todo.dueDate || todo.status !== "active") {
    return null;
  }

  if (todo.dueDate < todayKey) {
    return "overdue";
  }

  if (todo.dueDate === todayKey) {
    return "today";
  }

  return null;
}

const TAB_ITEMS: Array<{ id: string; label: string }> = [
  { id: "overview", label: "Översikt" },
  { id: "shopping", label: "Inköp" },
  { id: "recipes", label: "Recept" },
  { id: "todo", label: "To-do" },
  { id: "settings", label: "Inställningar" },
];

const DWELLING_ICON_SUGGESTIONS = ["🏠", "🏡", "🏢", "🏘️", "🌲", "🏖️", "🛖", "🚐", "⛺", "🏕️"];

const VISIBLE_ACTIVITY_TYPES: ActivityType[] = [
  "shopping_list_created",
  "shopping_completed",
  "todo_created",
  "todo_completed",
  "recipe_created",
];

export default function DomusApp({ initialJoinToken }: { initialJoinToken?: string }) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DomusDB>(createDefaultDb());
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION);
  const [tab, setTab] = useState("overview");
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [householdName, setHouseholdName] = useState("Vårt hushåll");
  const [joinTokenInput, setJoinTokenInput] = useState(initialJoinToken ?? "");

  const [shoppingInput, setShoppingInput] = useState("");
  const [activeShoppingListId, setActiveShoppingListId] = useState<string | null>(null);
  const [pendingNewList, setPendingNewList] = useState<PendingNewList | null>(null);
  const [presetName, setPresetName] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState<Unit>("st");
  const [pickedOpen, setPickedOpen] = useState(true);

  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState<Record<string, string[]>>({});
  const [recipeTargetListByRecipeId, setRecipeTargetListByRecipeId] = useState<Record<string, string>>({});
  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [recipeImageDataUrl, setRecipeImageDataUrl] = useState<string | undefined>(undefined);
  const [recipeIngredientInput, setRecipeIngredientInput] = useState("");
  const [recipeDraftIngredients, setRecipeDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [pendingRecipeIngredient, setPendingRecipeIngredient] = useState<PendingRecipeIngredient | null>(null);
  const [showRecipeImagePicker, setShowRecipeImagePicker] = useState(false);
  const [pendingNewProduct, setPendingNewProduct] = useState<PendingNewProduct | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<string[]>([]);

  const [newCatalogName, setNewCatalogName] = useState("");
  const [newCatalogCategory, setNewCatalogCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [newCatalogQuantity, setNewCatalogQuantity] = useState("1");
  const [newCatalogUnit, setNewCatalogUnit] = useState<Unit>("st");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogDefaultDrafts, setCatalogDefaultDrafts] = useState<Record<string, CatalogDefaultDraft>>({});

  const [todoTitle, setTodoTitle] = useState("");
  const [todoNote, setTodoNote] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [todoAssignee, setTodoAssignee] = useState<Todo["assignee"]>("none");
  const [todoDwellingId, setTodoDwellingId] = useState("");
  const [todoRecurrenceType, setTodoRecurrenceType] = useState<
    "once" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom"
  >("once");
  const [todoMonthlyMode, setTodoMonthlyMode] = useState<"date" | "last">("date");
  const [todoCustomInterval, setTodoCustomInterval] = useState(3);
  const [todoCustomUnit, setTodoCustomUnit] = useState<"day" | "week" | "month">("day");

  const [newDwellingName, setNewDwellingName] = useState("");
  const [newDwellingIcon, setNewDwellingIcon] = useState("");
  const [newDwellingAccent, setNewDwellingAccent] = useState("#2f6048");
  const [editingDwellingId, setEditingDwellingId] = useState<string | null>(null);
  const [editingDwellingName, setEditingDwellingName] = useState("");
  const [editingDwellingIcon, setEditingDwellingIcon] = useState("");
  const [editingDwellingAccent, setEditingDwellingAccent] = useState("#2f6048");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cloudLive, setCloudLive] = useState(CLOUD_ENABLED);
  const [cloudHydrated, setCloudHydrated] = useState(!CLOUD_ENABLED);
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const cloudPersistRef = useRef<Promise<void>>(Promise.resolve());
  const cloudRefreshTimerRef = useRef<number | null>(null);
  const lastCloudErrorRef = useRef(0);
  const recipeAlbumInputRef = useRef<HTMLInputElement | null>(null);
  const recipeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const pushToast = useCallback((message: string, actionLabel?: string, action?: () => void) => {
    const toastId = uid();
    setToasts((prev) => [...prev, { id: toastId, message, actionLabel, action }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toastId));
    }, 4500);
  }, []);

  const pushCloudError = useCallback(
    (message: string, error: unknown) => {
      console.error(message, error);
      const now = Date.now();
      if (now - lastCloudErrorRef.current < 5000) {
        return;
      }

      lastCloudErrorRef.current = now;
      pushToast("Cloud-sync misslyckades tillfälligt. Lokala ändringar finns kvar.");
    },
    [pushToast],
  );

  const syncProfileFromAuth = useCallback(
    async (authUser: SupabaseUser) => {
      if (!supabase) {
        return;
      }

      const firstName = String(authUser.user_metadata.first_name ?? authUser.user_metadata.firstName ?? "").trim() || "Domus";
      const lastName = String(authUser.user_metadata.last_name ?? authUser.user_metadata.lastName ?? "").trim() || "User";

      const { error } = await supabase.from(CLOUD_TABLES.profiles).upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        first_name: firstName,
        last_name: lastName,
        created_at: authUser.created_at,
      });

      if (error) {
        throw error;
      }
    },
    [supabase],
  );

  const hydrateCloudData = useCallback(
    async (userId: string, baseSession?: SessionState) => {
      if (!supabase) {
        return;
      }

      const [{ data: membershipRows, error: membershipError }, { data: catalogRows, error: catalogError }, { data: settingRows, error: settingError }] =
        await Promise.all([
          supabase.from(CLOUD_TABLES.members).select("household_id,user_id,joined_at"),
          supabase.from(CLOUD_TABLES.catalog).select("id,name,category,default_quantity,default_unit,units").order("name"),
          supabase.from(CLOUD_TABLES.settings).select("user_id,daily_summary_enabled,last_summary_date,category_overrides").eq("user_id", userId).maybeSingle(),
        ]);

      if (membershipError) throw membershipError;
      if (catalogError) throw catalogError;
      if (settingError) throw settingError;

      const householdIds = uniqueStrings((membershipRows ?? []).map((row) => row.household_id));
      const memberUserIds = uniqueStrings([userId, ...(membershipRows ?? []).map((row) => row.user_id)]);

      const [householdResponse, inviteResponse, stateResponse, profileResponse] = await Promise.all([
        householdIds.length
          ? supabase.from(CLOUD_TABLES.households).select("id,name,created_at,created_by").in("id", householdIds)
          : Promise.resolve({ data: [] as CloudHouseholdRow[], error: null }),
        householdIds.length
          ? supabase.from(CLOUD_TABLES.invites).select("token,household_id,created_at,expires_at,created_by,used_by,used_at").in("household_id", householdIds)
          : Promise.resolve({ data: [] as CloudInviteRow[], error: null }),
        householdIds.length
          ? supabase.from(CLOUD_TABLES.states).select("household_id,state,updated_at,updated_by").in("household_id", householdIds)
          : Promise.resolve({ data: [] as CloudStateRow[], error: null }),
        memberUserIds.length
          ? supabase.from(CLOUD_TABLES.profiles).select("id,email,first_name,last_name,created_at").in("id", memberUserIds)
          : Promise.resolve({ data: [] as CloudProfileRow[], error: null }),
      ]);

      if (householdResponse.error) throw householdResponse.error;
      if (inviteResponse.error) throw inviteResponse.error;
      if (stateResponse.error) throw stateResponse.error;
      if (profileResponse.error) throw profileResponse.error;

      const nextDb = buildDbFromCloudSnapshot({
        catalogRows: (catalogRows ?? []) as CloudCatalogRow[],
        currentUserId: userId,
        householdRows: (householdResponse.data ?? []) as CloudHouseholdRow[],
        inviteRows: (inviteResponse.data ?? []) as CloudInviteRow[],
        membershipRows: (membershipRows ?? []) as CloudMembershipRow[],
        profileRows: (profileResponse.data ?? []) as CloudProfileRow[],
        settingRow: (settingRows ?? null) as CloudUserSettingRow | null,
        stateRows: (stateResponse.data ?? []) as CloudStateRow[],
      });

      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(nextDb));
      setDb(nextDb);
      setSession((prev) =>
        normalizeSession({
          ...(baseSession ?? prev),
          currentUserId: userId,
        }),
      );
      setCloudLive(true);
    },
    [supabase],
  );

  const persistCloudDb = useCallback(
    (nextDb: DomusDB, prevDb: DomusDB, userId: string | null) => {
      if (!supabase || !userId) {
        return;
      }

      cloudPersistRef.current = cloudPersistRef.current
        .catch(() => undefined)
        .then(async () => {
          const visibleHouseholds = nextDb.households.filter((household) => household.memberIds.includes(userId));
          if (!visibleHouseholds.length) {
            return;
          }

          const visibleHouseholdIds = visibleHouseholds.map((household) => household.id);
          const previousVisibleHouseholdIds = prevDb.households.filter((household) => household.memberIds.includes(userId)).map((household) => household.id);
          const removedHouseholdIds = previousVisibleHouseholdIds.filter((householdId) => !visibleHouseholdIds.includes(householdId));
          const currentCatalogIds = nextDb.catalog.map((item) => item.id);
          const previousCatalogIds = prevDb.catalog.map((item) => item.id);
          const removedCatalogIds = previousCatalogIds.filter((catalogId) => !currentCatalogIds.includes(catalogId));
          const currentSetting = nextDb.settings.find((setting) => setting.userId === userId);

          const { error: catalogUpsertError } = await supabase.from(CLOUD_TABLES.catalog).upsert(
            nextDb.catalog.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              default_quantity: item.defaultQuantity,
              default_unit: item.defaultUnit,
              units: item.units,
              updated_by: userId,
            })),
          );
          if (catalogUpsertError) throw catalogUpsertError;

          if (removedCatalogIds.length) {
            const { error: catalogDeleteError } = await supabase.from(CLOUD_TABLES.catalog).delete().in("id", removedCatalogIds);
            if (catalogDeleteError) throw catalogDeleteError;
          }

          if (currentSetting) {
            const { error: settingError } = await supabase.from(CLOUD_TABLES.settings).upsert({
              user_id: userId,
              daily_summary_enabled: currentSetting.dailySummaryEnabled,
              last_summary_date: currentSetting.lastSummaryDate ?? null,
              category_overrides: currentSetting.categoryOverrides ?? {},
            });
            if (settingError) throw settingError;
          }

          for (const household of visibleHouseholds) {
            const householdExistedBefore = previousVisibleHouseholdIds.includes(household.id);
            const householdCreatedBy: string = household.createdBy ?? household.memberIds[0] ?? userId;

            if (householdCreatedBy === userId) {
              const { error: householdError } = await supabase.from(CLOUD_TABLES.households).upsert({
                id: household.id,
                name: household.name,
                created_at: toIsoTimestamp(household.createdAt),
                created_by: householdCreatedBy,
              });
              if (householdError) throw householdError;
            }

            const memberRows = uniqueStrings(household.memberIds).map((memberId) => ({
              household_id: household.id,
              user_id: memberId,
            }));
            if (memberRows.length) {
              const { error: memberError } = await supabase.from(CLOUD_TABLES.members).upsert(memberRows, {
                onConflict: "household_id,user_id",
              });
              if (memberError) throw memberError;
            }

            if (householdCreatedBy !== userId && householdExistedBefore) {
              const { error: householdError } = await supabase.from(CLOUD_TABLES.households).upsert({
                id: household.id,
                name: household.name,
                created_at: toIsoTimestamp(household.createdAt),
                created_by: householdCreatedBy,
              });
              if (householdError) throw householdError;
            }

            if (household.invites.length) {
              const { error: inviteError } = await supabase.from(CLOUD_TABLES.invites).upsert(
                household.invites.map((invite) => ({
                  token: invite.token,
                  household_id: household.id,
                  created_at: toIsoTimestamp(invite.createdAt),
                  expires_at: toIsoTimestamp(invite.expiresAt),
                  created_by: invite.createdBy,
                  used_by: invite.usedBy ?? null,
                  used_at: invite.usedAt ? toIsoTimestamp(invite.usedAt) : null,
                })),
              );
              if (inviteError) throw inviteError;
            }

            const { error: stateError } = await supabase.from(CLOUD_TABLES.states).upsert({
              household_id: household.id,
              state: buildCloudStateForHousehold(nextDb, household.id),
              updated_by: userId,
            });
            if (stateError) throw stateError;
          }

          if (removedHouseholdIds.length) {
            const { error: deleteError } = await supabase.from(CLOUD_TABLES.households).delete().in("id", removedHouseholdIds);
            if (deleteError) throw deleteError;
          }
        })
        .catch((error) => {
          pushCloudError("Failed to persist cloud db", error);
          setCloudLive(false);
        });
    },
    [pushCloudError, supabase],
  );

  const saveDb = useCallback((nextDb: DomusDB) => {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(nextDb));
    channelRef.current?.postMessage({ type: "db-updated", at: Date.now() });
  }, []);

  const saveSession = useCallback((nextSession: SessionState) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    channelRef.current?.postMessage({ type: "session-updated", at: Date.now() });
  }, []);

  const mutateDb = useCallback(
    (mutator: (draft: DomusDB) => void) => {
      setDb((prev) => {
        const draft = cloneDb(prev);
        mutator(draft);
        draft.meta.updatedAt = Date.now();
        saveDb(draft);
        persistCloudDb(draft, prev, session.currentUserId);
        return draft;
      });
    },
    [persistCloudDb, saveDb, session.currentUserId],
  );

  const mutateSession = useCallback(
    (mutator: (current: SessionState) => SessionState) => {
      setSession((prev) => {
        const next = mutator(prev);
        saveSession(next);
        return next;
      });
    },
    [saveSession],
  );

  useEffect(() => {
    const storedSession = parseJson<SessionState>(localStorage.getItem(SESSION_STORAGE_KEY), DEFAULT_SESSION);
    const storedDb = parseJson<DomusDB>(localStorage.getItem(DB_STORAGE_KEY), createDefaultDb());

    setSession(normalizeSession(storedSession));
    setDb(normalizeDb(storedDb));

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY && event.newValue) {
        const incoming = normalizeDb(parseJson<DomusDB>(event.newValue, createDefaultDb()));
        setDb((prev) => (incoming.meta.updatedAt >= prev.meta.updatedAt ? incoming : prev));
      }

      if (event.key === SESSION_STORAGE_KEY && event.newValue) {
        const incoming = normalizeSession(parseJson<SessionState>(event.newValue, DEFAULT_SESSION));
        setSession(incoming);
      }
    };

    const handleChannel = () => {
      const latestDb = normalizeDb(parseJson<DomusDB>(localStorage.getItem(DB_STORAGE_KEY), createDefaultDb()));
      const latestSession = normalizeSession(
        parseJson<SessionState>(localStorage.getItem(SESSION_STORAGE_KEY), DEFAULT_SESSION),
      );

      setDb((prev) => (latestDb.meta.updatedAt >= prev.meta.updatedAt ? latestDb : prev));
      setSession(latestSession);
    };

    window.addEventListener("storage", handleStorage);
    channel.addEventListener("message", handleChannel);

    if (!supabase) {
      setReady(true);
      setCloudLive(false);
      setCloudHydrated(true);
      return () => {
        window.removeEventListener("storage", handleStorage);
        channel.removeEventListener("message", handleChannel);
        channel.close();
      };
    }

    let cancelled = false;

    const initializeCloud = async () => {
      try {
        if (isLogoutPending()) {
          if (!cancelled) {
            const clearedSession = { ...DEFAULT_SESSION };
            setAuthUser(null);
            setDb(createDefaultDb());
            setSession(clearedSession);
            saveSession(clearedSession);
            setReady(true);
            setCloudLive(true);
            setCloudHydrated(true);
            setCloudLoadError(null);
          }

          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) {
            console.error("Failed to finish pending logout", error);
          }
          setLogoutPending(false);
          return;
        }

        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();

        if (!authSession?.user) {
          if (!cancelled) {
            setAuthUser(null);
            setDb(createDefaultDb());
            const clearedSession = { ...DEFAULT_SESSION };
            setSession(clearedSession);
            saveSession(clearedSession);
            setReady(true);
            setCloudLive(true);
            setCloudHydrated(true);
            setCloudLoadError(null);
          }
          return;
        }

        if (!cancelled) {
          const nextSession = normalizeSession({
            ...storedSession,
            currentUserId: authSession.user.id,
          });
          setAuthUser(authSession.user);
          setSession(nextSession);
          saveSession(nextSession);
          setReady(true);
          setCloudHydrated(false);
          setCloudLoadError(null);
        }

        await withTimeout(
          syncProfileFromAuth(authSession.user),
          5000,
          "Profilsynk mot cloud tog for lang tid.",
        );
        if (!cancelled) {
          await withTimeout(
            hydrateCloudData(
              authSession.user.id,
              normalizeSession({
                ...storedSession,
                currentUserId: authSession.user.id,
              }),
            ),
            5000,
            "Laddning av hushallet tog for lang tid.",
          );
          setCloudHydrated(true);
          setCloudLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to initialize cloud", error);
          setCloudLoadError(resolveErrorMessage(error, "Kunde inte lasa ditt hushall fran cloud."));
          setCloudHydrated(false);
          setCloudLive(false);
          setReady(true);
        }
      }
    };

    void initializeCloud();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, authSession: SupabaseSession | null) => {
      const nextSession = normalizeSession(parseJson<SessionState>(localStorage.getItem(SESSION_STORAGE_KEY), DEFAULT_SESSION));
      if (isLogoutPending()) {
        setAuthUser(null);
        setDb(createDefaultDb());
        const clearedSession = { ...DEFAULT_SESSION };
        setSession(clearedSession);
        saveSession(clearedSession);
        setReady(true);
        setCloudHydrated(true);
        setCloudLoadError(null);
        return;
      }

      if (!authSession?.user) {
        setAuthUser(null);
        setDb(createDefaultDb());
        const clearedSession = { ...DEFAULT_SESSION };
        setSession(clearedSession);
        saveSession(clearedSession);
        setReady(true);
        setCloudHydrated(true);
        setCloudLoadError(null);
        return;
      }

      const hydratedSession = normalizeSession({
        ...nextSession,
        currentUserId: authSession.user.id,
      });
      setAuthUser(authSession.user);
      setSession(hydratedSession);
      saveSession(hydratedSession);
      setReady(true);
      setCloudHydrated(false);
      setCloudLoadError(null);

      void syncProfileFromAuth(authSession.user)
        .then(() =>
          withTimeout(
            hydrateCloudData(
              authSession.user.id,
              hydratedSession,
            ),
            5000,
            "Laddning av hushallet tog for lang tid.",
          ),
        )
        .then(() => {
          setCloudHydrated(true);
          setCloudLoadError(null);
        })
        .catch((error) => {
          console.error("Failed to handle auth change", error);
          setCloudLoadError(resolveErrorMessage(error, "Kunde inte lasa ditt hushall fran cloud."));
          setCloudHydrated(false);
          setCloudLive(false);
        })
        .finally(() => setReady(true));
    });

    const liveChannel = supabase
      .channel("domus-live")
      .on("postgres_changes", { event: "*", schema: "public", table: CLOUD_TABLES.states }, () => {
        const userId = supabase.auth.getUser().then(({ data }) => data.user?.id ?? null);
        void userId.then((resolvedUserId) => {
          if (!resolvedUserId) return;
          if (cloudRefreshTimerRef.current) {
            window.clearTimeout(cloudRefreshTimerRef.current);
          }
          cloudRefreshTimerRef.current = window.setTimeout(() => {
            void hydrateCloudData(resolvedUserId);
          }, 120);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: CLOUD_TABLES.members }, () => {
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user?.id) {
            void hydrateCloudData(data.user.id);
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: CLOUD_TABLES.invites }, () => {
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user?.id) {
            void hydrateCloudData(data.user.id);
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: CLOUD_TABLES.catalog }, () => {
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user?.id) {
            void hydrateCloudData(data.user.id);
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: CLOUD_TABLES.settings }, () => {
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user?.id) {
            void hydrateCloudData(data.user.id);
          }
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      channel.removeEventListener("message", handleChannel);
      channel.close();
      subscription.unsubscribe();
      void supabase.removeChannel(liveChannel);
      if (cloudRefreshTimerRef.current) {
        window.clearTimeout(cloudRefreshTimerRef.current);
      }
    };
  }, [hydrateCloudData, pushCloudError, saveSession, supabase, syncProfileFromAuth]);

  const currentUser = useMemo(
    () =>
      db.users.find((user) => user.id === session.currentUserId) ??
      (authUser && session.currentUserId === authUser.id ? buildUserFromAuth(authUser) : null),
    [authUser, db.users, session.currentUserId],
  );

  const accountInitials = useMemo(() => {
    const firstName = (currentUser?.firstName ?? "").trim();
    const lastName = (currentUser?.lastName ?? "").trim();

    const first = firstName.charAt(0).toUpperCase();
    const second = lastName.charAt(0).toUpperCase();

    if (first && second) {
      return `${first}${second}`;
    }

    if (first) {
      return `${first}${firstName.charAt(1).toUpperCase() || "W"}`;
    }

    if (lastName) {
      return `${lastName.charAt(0).toUpperCase()}${lastName.charAt(1).toUpperCase() || "W"}`;
    }

    const emailPrefix = (currentUser?.email ?? "").slice(0, 1).toUpperCase();
    return `${emailPrefix || "J"}W`;
  }, [currentUser?.firstName, currentUser?.lastName, currentUser?.email]);

  const accountDisplayName = useMemo(() => {
    const name = `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim();
    return name || "Användare";
  }, [currentUser?.firstName, currentUser?.lastName]);

  useEffect(() => {
    if (!showAccountMenu) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (accountMenuRef.current && target instanceof Node && !accountMenuRef.current.contains(target)) {
        setShowAccountMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAccountMenu]);

  const myHouseholds = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return db.households.filter((household) => household.memberIds.includes(currentUser.id));
  }, [db.households, currentUser]);

  useEffect(() => {
    if (!ready || !currentUser) {
      return;
    }

    if (!session.activeHouseholdId || !myHouseholds.some((household) => household.id === session.activeHouseholdId)) {
      const firstHousehold = myHouseholds[0] ?? null;
      mutateSession((prev) => ({
        ...prev,
        activeHouseholdId: firstHousehold?.id ?? null,
      }));
      return;
    }

    const dwellingOptions = db.dwellings.filter((dwelling) => dwelling.householdId === session.activeHouseholdId);
    if (!session.activeDwellingId || !dwellingOptions.some((dwelling) => dwelling.id === session.activeDwellingId)) {
      mutateSession((prev) => ({
        ...prev,
        activeDwellingId: dwellingOptions[0]?.id ?? null,
      }));
    }
  }, [
    ready,
    currentUser,
    myHouseholds,
    session.activeHouseholdId,
    session.activeDwellingId,
    db.dwellings,
    mutateSession,
  ]);

  const activeHousehold = useMemo(
    () => db.households.find((household) => household.id === session.activeHouseholdId) ?? null,
    [db.households, session.activeHouseholdId],
  );

  const activeDwelling = useMemo(
    () => db.dwellings.find((dwelling) => dwelling.id === session.activeDwellingId) ?? null,
    [db.dwellings, session.activeDwellingId],
  );

  const latestShoppingListId = useMemo(() => {
    const dwellingId = activeDwelling?.id;
    if (!activeHousehold || !dwellingId) {
      return null;
    }

    return (
      db.shoppingLists
        .filter((item) => item.householdId === activeHousehold.id && item.dwellingId === dwellingId)
        .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null
    );
  }, [activeHousehold, activeDwelling?.id, db.shoppingLists]);

  const openTodo = useCallback(() => {
    setTab("todo");
  }, []);

  const openLatestShoppingList = useCallback(() => {
    setTab("shopping");
    setActiveShoppingListId(latestShoppingListId);
  }, [latestShoppingListId]);

  const householdMembers = useMemo(() => {
    if (!activeHousehold) {
      return [];
    }

    return db.users.filter((user) => activeHousehold.memberIds.includes(user.id));
  }, [activeHousehold, db.users]);

  const activeSetting = useMemo(() => {
    if (!currentUser) {
      return null;
    }

    return db.settings.find((item) => item.userId === currentUser.id) ?? null;
  }, [db.settings, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!activeSetting) {
      mutateDb((draft) => {
        draft.settings.push({
          id: uid(),
          userId: currentUser.id,
          dailySummaryEnabled: true,
          categoryOverrides: {},
        });
      });
    }
  }, [activeSetting, currentUser, mutateDb]);

  const resolveCategoryForUser = useCallback(
    (catalogItem: CatalogItem): string => {
      const override = activeSetting?.categoryOverrides?.[catalogItem.id];
      return override ?? catalogItem.category;
    },
    [activeSetting],
  );

  const addActivity = useCallback(
    (draft: DomusDB, entry: Omit<ActivityItem, "id" | "createdAt">) => {
      draft.activity.unshift({
        id: uid(),
        ...entry,
        createdAt: Date.now(),
      });
      draft.activity = draft.activity.slice(0, 150);
    },
    [],
  );

  const getLearningDefault = useCallback(
    (dwellingId: string, catalogItem: CatalogItem): { quantity: number; unit: Unit } => {
      const learned = db.learning.find(
        (item) => item.dwellingId === dwellingId && item.catalogItemId === catalogItem.id,
      );
      if (learned) {
        return { quantity: learned.quantity, unit: learned.unit };
      }

      return {
        quantity: catalogItem.defaultQuantity,
        unit: catalogItem.defaultUnit,
      };
    },
    [db.learning],
  );

  const categoryOrder = useMemo(() => {
    if (!activeDwelling) {
      return DEFAULT_CATEGORIES;
    }

    const found = db.categoryOrders.find((item) => item.dwellingId === activeDwelling.id);
    return normalizeCategoryOrder(found?.categories?.length ? found.categories : DEFAULT_CATEGORIES);
  }, [db.categoryOrders, activeDwelling]);

  const shoppingListsForDwelling = useMemo(() => {
    if (!activeDwelling) {
      return [];
    }

    return db.shoppingLists
      .filter((list) => list.dwellingId === activeDwelling.id && !list.archivedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [activeDwelling, db.shoppingLists]);

  const activeShoppingList = useMemo(
    () => shoppingListsForDwelling.find((list) => list.id === activeShoppingListId) ?? null,
    [activeShoppingListId, shoppingListsForDwelling],
  );

  useEffect(() => {
    if (!activeDwelling) {
      setActiveShoppingListId(null);
      return;
    }

    if (!activeShoppingListId) {
      return;
    }

    if (shoppingListsForDwelling.some((list) => list.id === activeShoppingListId)) {
      return;
    }

    setActiveShoppingListId(null);
  }, [activeDwelling, activeShoppingListId, shoppingListsForDwelling]);

  const dwellingShoppingItems = useMemo(() => {
    if (!activeDwelling || !activeShoppingListId) {
      return [];
    }

    return db.shopping
      .filter((item) => item.dwellingId === activeDwelling.id && item.shoppingListId === activeShoppingListId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [activeShoppingListId, db.shopping, activeDwelling]);

  const unpickedItems = useMemo(
    () => dwellingShoppingItems.filter((item) => !item.checked),
    [dwellingShoppingItems],
  );

  const pickedItems = useMemo(
    () => dwellingShoppingItems.filter((item) => item.checked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)),
    [dwellingShoppingItems],
  );

  const shoppingByCategory = useMemo(() => {
    const grouped = new Map<string, ShoppingItem[]>();
    unpickedItems.forEach((item) => {
      const category = activeSetting?.categoryOverrides?.[item.catalogItemId] ?? item.category;
      const list = grouped.get(category) ?? [];
      list.push(item);
      grouped.set(category, list);
    });

    const ordered = uniqueStrings(categoryOrder.filter((category) => grouped.has(category)));
    grouped.forEach((_value, key) => {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    });

    return ordered.map((category) => ({
      category,
      items: grouped.get(category) ?? [],
    }));
  }, [activeSetting?.categoryOverrides, unpickedItems, categoryOrder]);

  const presetsForDwelling = useMemo(() => {
    if (!activeDwelling) {
      return [];
    }

    return db.presets.filter((preset) => preset.dwellingId === activeDwelling.id).sort((a, b) => b.createdAt - a.createdAt);
  }, [activeDwelling, db.presets]);

  const householdTodos = useMemo(() => {
    if (!activeHousehold) {
      return [];
    }

    return db.todos
      .filter((todo) => todo.householdId === activeHousehold.id)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }

        return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
      });
  }, [activeHousehold, db.todos]);

  const todoStats = useMemo(() => {
    const total = householdTodos.filter((todo) => todo.status === "active").length;
    const today = toISODate(new Date());
    const dueToday = householdTodos.filter((todo) => todo.status === "active" && todo.dueDate === today).length;
    const overdue = householdTodos.filter((todo) => todo.status === "active" && (todo.dueDate ?? "9999-12-31") < today).length;

    return { total, dueToday, overdue };
  }, [householdTodos]);

  const runDailySummary = useCallback(
    (force = false) => {
      if (!currentUser || !activeHousehold) {
        return;
      }

      const setting = db.settings.find((item) => item.userId === currentUser.id);
      if (!setting || !setting.dailySummaryEnabled) {
        return;
      }

      const { dateKey, hour } = getStockholmParts(new Date());
      if (!force && hour !== 8) {
        return;
      }

      if (setting.lastSummaryDate === dateKey) {
        pushToast("Dagens sammanställning är redan skickad.");
        return;
      }

      const relevant = db.todos.filter((todo) => {
        if (todo.householdId !== activeHousehold.id || todo.status !== "active") {
          return false;
        }

        if (todo.assignee === "none" || todo.assignee === "all") {
          return true;
        }

        return todo.assignee === currentUser.id;
      });

      const overdue = relevant.filter((todo) => todo.dueDate && todo.dueDate < dateKey);
      const today = relevant.filter((todo) => todo.dueDate === dateKey);

      if (!overdue.length && !today.length) {
        if (force) {
          pushToast("Ingen relevant to-do just nu.");
        }

        mutateDb((draft) => {
          const target = draft.settings.find((item) => item.userId === currentUser.id);
          if (target) {
            target.lastSummaryDate = dateKey;
          }
        });
        return;
      }

      const groupedByDwelling = new Map<string, number>();
      [...overdue, ...today].forEach((todo) => {
        const key = todo.dwellingId ?? "global";
        groupedByDwelling.set(key, (groupedByDwelling.get(key) ?? 0) + 1);
      });

      const parts: string[] = [];
      groupedByDwelling.forEach((count, key) => {
        if (key === "global") {
          parts.push(`Hushållet: ${count}`);
          return;
        }

        const dwellingName = db.dwellings.find((dwelling) => dwelling.id === key)?.name ?? "Boende";
        parts.push(`${dwellingName}: ${count}`);
      });

      pushToast(`Daglig sammanställning: ${parts.join(" | ")}`);

      if (typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          new Notification("Domus", {
            body: `Du har uppgifter idag: ${parts.join(" | ")}`,
          });
        } else if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => undefined);
        }
      }

      mutateDb((draft) => {
        const target = draft.settings.find((item) => item.userId === currentUser.id);
        if (target) {
          target.lastSummaryDate = dateKey;
        }
      });
    },
    [activeHousehold, currentUser, db, mutateDb, pushToast],
  );

  useEffect(() => {
    if (!currentUser || !activeHousehold) {
      return;
    }

    const interval = window.setInterval(() => runDailySummary(), 60_000);
    return () => window.clearInterval(interval);
  }, [activeHousehold, currentUser, runDailySummary]);

  const createShoppingList = useCallback(
    (nameInput: string): string | null => {
      if (!currentUser || !activeHousehold || !activeDwelling) {
        return null;
      }

      const name = nameInput.trim() || "Inköpslista";
      const shoppingListId = uid();

      mutateDb((draft) => {
        draft.shoppingLists.push({
          id: shoppingListId,
          householdId: activeHousehold.id,
          dwellingId: activeDwelling.id,
          name,
          createdAt: Date.now(),
          createdBy: currentUser.id,
        });

        addActivity(draft, {
          type: "shopping_list_created",
          householdId: activeHousehold.id,
          dwellingId: activeDwelling.id,
          message: `${currentUser.firstName} skapade ny handlingslista: ${name}`,
        });
      });

      setActiveShoppingListId(shoppingListId);
      return shoppingListId;
    },
    [activeDwelling, activeHousehold, addActivity, currentUser, mutateDb],
  );

  const addShoppingFromCatalog = useCallback(
    (
      catalogItem: CatalogItem,
      quantityOverride?: number,
      unitOverride?: Unit,
      options?: {
        skipIfExists?: boolean;
      },
      shoppingListIdOverride?: string,
    ) => {
      if (!currentUser || !activeHousehold || !activeDwelling) {
        return;
      }

      const shoppingListId = shoppingListIdOverride ?? activeShoppingListId;
      if (!shoppingListId) {
        setPendingNewList({
          name: "Inköpslista",
          pendingInput: catalogItem.name,
        });
        return;
      }

      const learned = getLearningDefault(activeDwelling.id, catalogItem);
      const quantity = quantityOverride ?? learned.quantity;
      const unit = unitOverride ?? learned.unit;
      const category = resolveCategoryForUser(catalogItem);

      mutateDb((draft) => {
        const existing = draft.shopping.find(
          (item) =>
            item.dwellingId === activeDwelling.id &&
            item.shoppingListId === shoppingListId &&
            item.catalogItemId === catalogItem.id &&
            (options?.skipIfExists ? true : !item.checked),
        );

        if (existing) {
          if (options?.skipIfExists) {
            return;
          }

          existing.quantity = existing.unit === unit ? existing.quantity + quantity : quantity;
          existing.unit = unit;
          existing.category = category;
          existing.updatedAt = Date.now();
          existing.updatedBy = currentUser.id;
          return;
        }

        draft.shopping.push({
          id: uid(),
          householdId: activeHousehold.id,
          dwellingId: activeDwelling.id,
          shoppingListId,
          catalogItemId: catalogItem.id,
          name: catalogItem.name,
          category,
          quantity,
          unit,
          checked: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: currentUser.id,
        });
      });
    },
    [
      activeDwelling,
      activeHousehold,
      activeShoppingListId,
      currentUser,
      getLearningDefault,
      mutateDb,
      resolveCategoryForUser,
    ],
  );

  const addShoppingFromInput = useCallback(
    (inputValue: string, shoppingListId: string) => {
      const parsed = parseShoppingInput(inputValue);
      if (!parsed.query.trim()) {
        pushToast("Skriv en vara först.");
        return;
      }

      const topSuggestion = getSuggestions(parsed.query, db.catalog)[0];
      if (!topSuggestion) {
        setPendingNewProduct({
          name: parsed.query.trim(),
          quantity: parsed.quantity ?? 1,
          unit: "st",
          category: DEFAULT_CATEGORIES[0],
          shoppingListId,
        });
        return;
      }

      addShoppingFromCatalog(topSuggestion, parsed.quantity, undefined, undefined, shoppingListId);
      setShoppingInput("");
    },
    [addShoppingFromCatalog, db.catalog, pushToast],
  );

  const handleAddShopping = useCallback(() => {
    if (!shoppingInput.trim()) {
      pushToast("Skriv en vara först.");
      return;
    }

    if (!activeShoppingListId) {
      setPendingNewList({
        name: "Inköpslista",
        pendingInput: shoppingInput,
      });
      return;
    }

    addShoppingFromInput(shoppingInput, activeShoppingListId);
  }, [activeShoppingListId, addShoppingFromInput, pushToast, shoppingInput]);

  const saveInlineEdit = useCallback(() => {
    if (!editingItemId || !currentUser) {
      return;
    }

    const quantity = Number(editQuantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      pushToast("Ange ett giltigt antal.");
      return;
    }

    mutateDb((draft) => {
      const item = draft.shopping.find((candidate) => candidate.id === editingItemId);
      if (!item) {
        return;
      }

      item.quantity = quantity;
      item.unit = editUnit;
      item.updatedAt = Date.now();
      item.updatedBy = currentUser.id;

      const learned = draft.learning.find(
        (entry) => entry.dwellingId === item.dwellingId && entry.catalogItemId === item.catalogItemId,
      );

      if (learned) {
        learned.quantity = quantity;
        learned.unit = editUnit;
        learned.updatedAt = Date.now();
      } else {
        draft.learning.push({
          id: uid(),
          dwellingId: item.dwellingId,
          catalogItemId: item.catalogItemId,
          quantity,
          unit: editUnit,
          updatedAt: Date.now(),
        });
      }

    });

    setEditingItemId(null);
  }, [currentUser, editQuantity, editUnit, editingItemId, mutateDb, pushToast]);

  const login = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      if (supabase) {
        setLogoutPending(false);
        setCloudLoadError(null);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(loginEmail),
          password: loginPassword,
        });

        if (error) {
          pushToast(error.message === "Invalid login credentials" ? "Fel e-post eller lösenord." : error.message);
          return;
        }

        if (data.user) {
          setLogoutPending(false);
          const immediateUser = buildUserFromAuth(data.user);
          setAuthUser(data.user);
          setDb((prev) =>
            normalizeDb({
              ...prev,
              users: prev.users.some((user) => user.id === immediateUser.id)
                ? prev.users.map((user) => (user.id === immediateUser.id ? { ...user, ...immediateUser } : user))
                : [...prev.users, immediateUser],
            }),
          );
          const nextSession: SessionState = {
            currentUserId: data.user.id,
            activeHouseholdId: session.activeHouseholdId,
            activeDwellingId: session.activeDwellingId,
          };
          setSession(nextSession);
          saveSession(nextSession);
          setReady(true);
        }

        pushToast("Välkommen tillbaka.");
        return;
      }

      const email = normalizeEmail(loginEmail);
      const found = db.users.find((user) => normalizeEmail(user.email) === email && user.password === loginPassword);
      if (!found) {
        pushToast("Fel e-post eller lösenord.");
        return;
      }

      const household = db.households.find((item) => item.memberIds.includes(found.id));
      const dwelling = household
        ? db.dwellings.find((item) => item.householdId === household.id)
        : null;

      const nextSession: SessionState = {
        currentUserId: found.id,
        activeHouseholdId: household?.id ?? null,
        activeDwellingId: dwelling?.id ?? null,
      };

      setSession(nextSession);
      saveSession(nextSession);
      pushToast(`Välkommen tillbaka ${found.firstName}.`);
    },
    [
      db.dwellings,
      db.households,
      db.users,
      loginEmail,
      loginPassword,
      pushToast,
      saveSession,
      session.activeDwellingId,
      session.activeHouseholdId,
      supabase,
    ],
  );

  const signup = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      const firstName = signupFirstName.trim();
      const lastName = signupLastName.trim();
      const email = normalizeEmail(signupEmail);
      const password = signupPassword;

      if (!firstName || !lastName || !email || !password) {
        pushToast("Fyll i förnamn, efternamn, e-post och lösenord.");
        return;
      }

      if (supabase) {
        setLogoutPending(false);
        setCloudLoadError(null);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });

        if (error) {
          pushToast(error.message.includes("already registered") ? "Det finns redan ett konto med den e-posten." : error.message);
          return;
        }

        if (data.user) {
          setLogoutPending(false);
          const immediateUser = buildUserFromAuth(data.user);
          setAuthUser(data.user);
          setDb((prev) =>
            normalizeDb({
              ...prev,
              users: prev.users.some((user) => user.id === immediateUser.id)
                ? prev.users.map((user) => (user.id === immediateUser.id ? { ...user, ...immediateUser } : user))
                : [...prev.users, immediateUser],
            }),
          );
          const nextSession: SessionState = {
            currentUserId: data.user.id,
            activeHouseholdId: null,
            activeDwellingId: null,
          };
          setSession(nextSession);
          saveSession(nextSession);
          setReady(true);
          try {
            await syncProfileFromAuth(data.user);
          } catch (profileError) {
            pushCloudError("Failed to upsert profile after signup", profileError);
          }
        }

        if (!data.session) {
          const signInResult = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInResult.error) {
            pushToast("Kontot är skapat. Bekräfta e-post om projektet kräver det.");
            return;
          }
        }

        pushToast(`Hej ${firstName}, kontot är skapat.`);
        return;
      }

      const exists = db.users.some((user) => normalizeEmail(user.email) === email);
      if (exists) {
        pushToast("Det finns redan ett konto med den e-posten.");
        return;
      }

      const newUser: User = {
        id: uid(),
        firstName,
        lastName,
        email,
        password,
        createdAt: Date.now(),
      };

      mutateDb((draft) => {
        draft.users.push(newUser);
      });

      const nextSession: SessionState = {
        currentUserId: newUser.id,
        activeHouseholdId: null,
        activeDwellingId: null,
      };
      setSession(nextSession);
      saveSession(nextSession);
      pushToast(`Hej ${newUser.firstName}, kontot är skapat.`);
    },
    [
      db.users,
      mutateDb,
      pushCloudError,
      pushToast,
      saveSession,
      signupEmail,
      signupFirstName,
      signupLastName,
      signupPassword,
      supabase,
      syncProfileFromAuth,
    ],
  );

  const createHousehold = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!currentUser) {
        return;
      }

      const name = householdName.trim() || "Vårt hushåll";
      const householdId = uid();
      const dwellingId = uid();

      mutateDb((draft) => {
        draft.households.push({
          id: householdId,
          name,
          memberIds: [currentUser.id],
          invites: [],
          createdAt: Date.now(),
          createdBy: currentUser.id,
        });

        draft.dwellings.push({
          id: dwellingId,
          householdId,
          name: "Huset",
          icon: "🏠",
          accentColor: "#2f6048",
          createdAt: Date.now(),
        });
      });

      const nextSession: SessionState = {
        currentUserId: currentUser.id,
        activeHouseholdId: householdId,
        activeDwellingId: dwellingId,
      };

      setSession(nextSession);
      saveSession(nextSession);
      pushToast("Hushållet är klart.");
    },
    [currentUser, householdName, mutateDb, pushToast, saveSession],
  );

  const joinByToken = useCallback(
    (rawToken: string) => {
      if (!currentUser) {
        return;
      }

      const token = extractToken(rawToken);
      if (!token) {
        pushToast("Ange en giltig länktoken.");
        return;
      }

      let joinedHouseholdId: string | null = null;

      mutateDb((draft) => {
        const now = Date.now();
        const household = draft.households.find((item) =>
          item.invites.some((invite) => invite.token === token),
        );

        if (!household) {
          return;
        }

        const invite = household.invites.find((item) => item.token === token);
        if (!invite || invite.expiresAt < now || invite.usedBy) {
          return;
        }

        if (!household.memberIds.includes(currentUser.id)) {
          household.memberIds.push(currentUser.id);
        }

        invite.usedBy = currentUser.id;
        invite.usedAt = now;
        joinedHouseholdId = household.id;

      });

      if (!joinedHouseholdId) {
        pushToast("Länken är ogiltig eller har redan använts.");
        return;
      }

      const firstDwelling = db.dwellings.find((dwelling) => dwelling.householdId === joinedHouseholdId);
      const nextSession: SessionState = {
        currentUserId: currentUser.id,
        activeHouseholdId: joinedHouseholdId,
        activeDwellingId: firstDwelling?.id ?? null,
      };
      setSession(nextSession);
      saveSession(nextSession);
      pushToast("Du är nu ansluten till hushållet.");
    },
    [currentUser, db.dwellings, mutateDb, pushToast, saveSession],
  );

  const createInvite = useCallback(() => {
    if (!activeHousehold || !currentUser) {
      return;
    }

    const token = uid().replace(/-/g, "");

    mutateDb((draft) => {
      const household = draft.households.find((item) => item.id === activeHousehold.id);
      if (!household) {
        return;
      }

      household.invites.unshift({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        createdBy: currentUser.id,
      });
    });

    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url).catch(() => undefined);
    pushToast("Inbjudningslänken är kopierad.");
  }, [activeHousehold, currentUser, mutateDb, pushToast]);

  const toggleShoppingChecked = useCallback(
    (itemId: string) => {
      if (!currentUser) {
        return;
      }

      mutateDb((draft) => {
        const item = draft.shopping.find((candidate) => candidate.id === itemId);
        if (!item) {
          return;
        }

        item.checked = !item.checked;
        item.checkedAt = item.checked ? Date.now() : undefined;
        item.updatedBy = currentUser.id;
        item.updatedAt = Date.now();

        if (item.checked) {
          const hasUncheckedItems = draft.shopping.some(
            (candidate) =>
              candidate.dwellingId === item.dwellingId &&
              candidate.shoppingListId === item.shoppingListId &&
              !candidate.checked,
          );
          if (!hasUncheckedItems) {
            const dwellingName =
              draft.dwellings.find((dwelling) => dwelling.id === item.dwellingId)?.name ?? "boendet";
            addActivity(draft, {
              type: "shopping_completed",
              householdId: item.householdId,
              dwellingId: item.dwellingId,
              message: `${currentUser.firstName} slutförde handlingen i ${dwellingName}`,
            });
          }
        }
      });
    },
    [addActivity, currentUser, mutateDb],
  );

  const adjustShoppingQuantity = useCallback(
    (itemId: string, delta: number) => {
      if (!currentUser) {
        return;
      }

      mutateDb((draft) => {
        const item = draft.shopping.find((candidate) => candidate.id === itemId);
        if (!item) {
          return;
        }

        const nextQuantity = Math.max(1, Math.round((item.quantity + delta) * 100) / 100);
        item.quantity = nextQuantity;
        item.updatedAt = Date.now();
        item.updatedBy = currentUser.id;

        const learned = draft.learning.find(
          (entry) => entry.dwellingId === item.dwellingId && entry.catalogItemId === item.catalogItemId,
        );

        if (learned) {
          learned.quantity = nextQuantity;
          learned.updatedAt = Date.now();
        } else {
          draft.learning.push({
            id: uid(),
            dwellingId: item.dwellingId,
            catalogItemId: item.catalogItemId,
            quantity: nextQuantity,
            unit: item.unit,
            updatedAt: Date.now(),
          });
        }
      });
    },
    [currentUser, mutateDb],
  );

  const removeShoppingItem = useCallback(
    (item: ShoppingItem) => {
      mutateDb((draft) => {
        draft.shopping = draft.shopping.filter((candidate) => candidate.id !== item.id);
      });

      pushToast(`Tog bort ${item.name}`, "Ångra", () => {
        mutateDb((draft) => {
          const exists = draft.shopping.some((candidate) => candidate.id === item.id);
          if (!exists) {
            draft.shopping.push(item);
          }
        });
      });
    },
    [mutateDb, pushToast],
  );

  const clearShoppingList = useCallback(() => {
    if (!activeDwelling || !activeShoppingListId) {
      return;
    }

    const removedItems = dwellingShoppingItems;
    if (!removedItems.length) {
      pushToast("Inköpslistan är redan tom.");
      return;
    }

    mutateDb((draft) => {
      draft.shopping = draft.shopping.filter((item) => item.shoppingListId !== activeShoppingListId);
    });

    const activeName = activeShoppingList?.name ?? "Inköpslista";
    pushToast(`Rensade listan ${activeName}`, "Ångra", () => {
      mutateDb((draft) => {
        const existingIds = new Set(draft.shopping.map((item) => item.id));
        removedItems.forEach((item) => {
          if (!existingIds.has(item.id)) {
            draft.shopping.push(item);
          }
        });
      });
    });
  }, [activeDwelling, activeShoppingList, activeShoppingListId, dwellingShoppingItems, mutateDb, pushToast]);

  const confirmCreateMissingProduct = useCallback(() => {
    if (!pendingNewProduct || !currentUser || !activeHousehold || !activeDwelling) {
      return;
    }

    const productName = pendingNewProduct.name.trim();
    if (!productName) {
      pushToast("Produktnamn saknas.");
      return;
    }

    const quantity = Math.max(0.01, pendingNewProduct.quantity);
    const productId = uid();
    const newProduct: CatalogItem = {
      id: productId,
      name: productName,
      category: pendingNewProduct.category,
      defaultQuantity: quantity,
      defaultUnit: pendingNewProduct.unit,
      units: [pendingNewProduct.unit, "st", "pkt", "kg", "g", "l", "dl", "ml", "burk"].filter(
        (unit, index, array) => array.indexOf(unit) === index,
      ) as Unit[],
    };

    mutateDb((draft) => {
      draft.catalog.push(newProduct);
      draft.shopping.push({
        id: uid(),
        householdId: activeHousehold.id,
        dwellingId: activeDwelling.id,
        shoppingListId: pendingNewProduct.shoppingListId,
        catalogItemId: newProduct.id,
        name: newProduct.name,
        category: pendingNewProduct.category,
        quantity,
        unit: pendingNewProduct.unit,
        checked: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: currentUser.id,
      });
    });

    setShoppingInput("");
    setPendingNewProduct(null);
    pushToast(`Lade till ${newProduct.name}.`);
  }, [activeDwelling, activeHousehold, currentUser, mutateDb, pendingNewProduct, pushToast]);

  const openCategoryOrganizer = useCallback(() => {
    setCategoryDraft(normalizeCategoryOrder(categoryOrder));
    setShowCategoryModal(true);
  }, [categoryOrder]);

  const reorderCategoryDraft = useCallback((category: string, direction: -1 | 1) => {
    setCategoryDraft((prev) => {
      const next = [...prev];
      const from = next.indexOf(category);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) {
        return prev;
      }
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  const saveCategoryOrder = useCallback(() => {
    if (!activeDwelling) {
      return;
    }

    mutateDb((draft) => {
      const sanitizedCategories = normalizeCategoryOrder(categoryDraft);
      const record = draft.categoryOrders.find((entry) => entry.dwellingId === activeDwelling.id);
      if (record) {
        record.categories = sanitizedCategories;
        record.updatedAt = Date.now();
      } else {
        draft.categoryOrders.push({
          id: uid(),
          dwellingId: activeDwelling.id,
          categories: sanitizedCategories,
          updatedAt: Date.now(),
        });
      }
    });

    setShowCategoryModal(false);
    pushToast("Kategoriordningen är sparad.");
  }, [activeDwelling, categoryDraft, mutateDb, pushToast]);

  const archiveActiveShoppingList = useCallback(() => {
    if (!activeShoppingListId || !activeShoppingList) {
      return;
    }

    const listId = activeShoppingListId;
    const listName = activeShoppingList.name;

    mutateDb((draft) => {
      const list = draft.shoppingLists.find((entry) => entry.id === listId);
      if (!list) {
        return;
      }

      list.archivedAt = Date.now();
    });

    setActiveShoppingListId(null);
    pushToast(`Arkiverade listan ${listName}.`);
  }, [activeShoppingList, activeShoppingListId, mutateDb, pushToast]);

  const deleteActiveShoppingList = useCallback(() => {
    if (!activeShoppingListId || !activeShoppingList) {
      return;
    }

    const listId = activeShoppingListId;
    const listName = activeShoppingList.name;
    const shouldDelete = window.confirm(`Radera listan "${listName}" permanent?`);
    if (!shouldDelete) {
      return;
    }

    mutateDb((draft) => {
      draft.shoppingLists = draft.shoppingLists.filter((entry) => entry.id !== listId);
      draft.shopping = draft.shopping.filter((entry) => entry.shoppingListId !== listId);
    });

    setActiveShoppingListId(null);
    pushToast(`Raderade listan ${listName}.`);
  }, [activeShoppingList, activeShoppingListId, mutateDb, pushToast]);

  const savePreset = useCallback(() => {
    if (!currentUser || !activeDwelling || !activeHousehold) {
      return;
    }

    const name = presetName.trim();
    if (!name) {
      pushToast("Namnge preset innan du sparar.");
      return;
    }

    const currentItems = unpickedItems.map((item) => ({
      catalogItemId: item.catalogItemId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
    }));

    if (!currentItems.length) {
      pushToast("Inköpslistan är tom just nu.");
      return;
    }

    mutateDb((draft) => {
      draft.presets.push({
        id: uid(),
        householdId: activeHousehold.id,
        dwellingId: activeDwelling.id,
        name,
        items: currentItems,
        createdAt: Date.now(),
        createdBy: currentUser.id,
      });
    });

    setPresetName("");
    pushToast("Preset sparad.");
  }, [activeDwelling, activeHousehold, currentUser, mutateDb, presetName, pushToast, unpickedItems]);

  const applyPreset = useCallback(
    (preset: Preset) => {
      if (!currentUser || !activeDwelling || !activeHousehold || !activeShoppingListId) {
        return;
      }

      mutateDb((draft) => {
        preset.items.forEach((presetItem) => {
          const exists = draft.shopping.some(
            (item) =>
              item.dwellingId === activeDwelling.id &&
              item.shoppingListId === activeShoppingListId &&
              item.catalogItemId === presetItem.catalogItemId &&
              !item.checked,
          );
          if (exists) {
            return;
          }

          draft.shopping.push({
            id: uid(),
            householdId: activeHousehold.id,
            dwellingId: activeDwelling.id,
            shoppingListId: activeShoppingListId,
            catalogItemId: presetItem.catalogItemId,
            name: presetItem.name,
            category: presetItem.category,
            quantity: presetItem.quantity,
            unit: presetItem.unit,
            checked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updatedBy: currentUser.id,
          });
        });

      });

      pushToast(`Preset ${preset.name} applicerad.`);
    },
    [activeDwelling, activeHousehold, activeShoppingListId, currentUser, mutateDb, pushToast],
  );

  const removePreset = useCallback(
    (presetId: string) => {
      mutateDb((draft) => {
        draft.presets = draft.presets.filter((item) => item.id !== presetId);
      });
      pushToast("Preset borttagen.");
    },
    [mutateDb, pushToast],
  );

  const addCatalogItemFromSettings = useCallback(() => {
    const name = newCatalogName.trim();
    const quantity = Number(newCatalogQuantity.replace(",", "."));

    if (!name) {
      pushToast("Skriv ett produktnamn.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      pushToast("Ange ett giltigt standardantal.");
      return;
    }

    mutateDb((draft) => {
      draft.catalog.push({
        id: uid(),
        name,
        category: newCatalogCategory,
        defaultQuantity: quantity,
        defaultUnit: newCatalogUnit,
        units: [newCatalogUnit, "st", "pkt", "kg", "g", "l", "dl", "ml", "burk"].filter(
          (unit, index, array) => array.indexOf(unit) === index,
        ) as Unit[],
      });
    });

    setNewCatalogName("");
    setNewCatalogQuantity("1");
    setNewCatalogUnit("st");
    pushToast("Vara upplagd.");
  }, [mutateDb, newCatalogCategory, newCatalogName, newCatalogQuantity, newCatalogUnit, pushToast]);

  const updateCatalogItem = useCallback(
    (catalogItemId: string, updates: Partial<CatalogItem>) => {
      mutateDb((draft) => {
        const item = draft.catalog.find((entry) => entry.id === catalogItemId);
        if (!item) {
          return;
        }

        let shouldSyncLearning = false;
        let nextLearningQuantity = item.defaultQuantity;
        let nextLearningUnit = item.defaultUnit;

        if (typeof updates.name === "string") {
          item.name = updates.name;
        }
        if (typeof updates.category === "string") {
          item.category = updates.category;
        }
        if (typeof updates.defaultQuantity === "number" && updates.defaultQuantity > 0) {
          item.defaultQuantity = updates.defaultQuantity;
          shouldSyncLearning = true;
          nextLearningQuantity = updates.defaultQuantity;
        }
        if (updates.defaultUnit) {
          item.defaultUnit = updates.defaultUnit;
          shouldSyncLearning = true;
          nextLearningUnit = updates.defaultUnit;
          if (!item.units.includes(updates.defaultUnit)) {
            item.units.push(updates.defaultUnit);
          }
        }

        if (shouldSyncLearning) {
          draft.learning.forEach((learning) => {
            if (learning.catalogItemId !== catalogItemId) {
              return;
            }
            learning.quantity = nextLearningQuantity;
            learning.unit = nextLearningUnit;
            learning.updatedAt = Date.now();
          });
        }
      });
    },
    [mutateDb],
  );

  const saveCatalogDefaults = useCallback(
    (catalogItemId: string) => {
      const catalogItem = db.catalog.find((entry) => entry.id === catalogItemId);
      if (!catalogItem) {
        return;
      }

      const draft = catalogDefaultDrafts[catalogItemId];
      const quantityInput = draft?.quantity ?? String(catalogItem.defaultQuantity);
      const quantity = Number(quantityInput.replace(",", "."));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        pushToast("Ange ett giltigt standardantal.");
        return;
      }

      const unit = draft?.unit ?? catalogItem.defaultUnit;

      mutateDb((draftDb) => {
        const target = draftDb.catalog.find((entry) => entry.id === catalogItemId);
        if (!target) {
          return;
        }

        target.defaultQuantity = quantity;
        target.defaultUnit = unit;
        if (!target.units.includes(unit)) {
          target.units.push(unit);
        }

        if (activeDwelling) {
          const learning = draftDb.learning.find(
            (entry) => entry.dwellingId === activeDwelling.id && entry.catalogItemId === catalogItemId,
          );
          if (learning) {
            learning.quantity = quantity;
            learning.unit = unit;
            learning.updatedAt = Date.now();
          } else {
            draftDb.learning.push({
              id: uid(),
              dwellingId: activeDwelling.id,
              catalogItemId,
              quantity,
              unit,
              updatedAt: Date.now(),
            });
          }
        }
      });

      setCatalogDefaultDrafts((prev) => ({
        ...prev,
        [catalogItemId]: { quantity: String(quantity), unit },
      }));
      pushToast(`Sparade standard för ${catalogItem.name}.`);
    },
    [activeDwelling, catalogDefaultDrafts, db.catalog, mutateDb, pushToast],
  );

  const removeCatalogItem = useCallback(
    (catalogItemId: string) => {
      mutateDb((draft) => {
        draft.catalog = draft.catalog.filter((item) => item.id !== catalogItemId);
        draft.shopping = draft.shopping.filter((item) => item.catalogItemId !== catalogItemId);
        draft.learning = draft.learning.filter((item) => item.catalogItemId !== catalogItemId);
        draft.presets = draft.presets.map((preset) => ({
          ...preset,
          items: preset.items.filter((item) => item.catalogItemId !== catalogItemId),
        }));
        draft.recipes = draft.recipes.map((recipe) => ({
          ...recipe,
          ingredients: recipe.ingredients.filter((ingredient) => ingredient.catalogItemId !== catalogItemId),
        }));
        draft.settings.forEach((setting) => {
          if (!setting.categoryOverrides) {
            return;
          }
          delete setting.categoryOverrides[catalogItemId];
        });
      });

      pushToast("Vara borttagen.");
    },
    [mutateDb, pushToast],
  );

  const updateCategoryOverride = useCallback(
    (catalogItemId: string, category: string) => {
      if (!currentUser) {
        return;
      }

      mutateDb((draft) => {
        let setting = draft.settings.find((item) => item.userId === currentUser.id);
        if (!setting) {
          setting = {
            id: uid(),
            userId: currentUser.id,
            dailySummaryEnabled: true,
            categoryOverrides: {},
          };
          draft.settings.push(setting);
        }

        if (!setting.categoryOverrides) {
          setting.categoryOverrides = {};
        }
        setting.categoryOverrides[catalogItemId] = category;
      });
    },
    [currentUser, mutateDb],
  );

  const addRecipeIngredientFromCatalog = useCallback(
    (catalogItem: CatalogItem, quantityOverride?: number, unitOverride?: Unit) => {
      const quantity = quantityOverride ?? catalogItem.defaultQuantity;
      const unit = unitOverride ?? catalogItem.defaultUnit;

      setRecipeDraftIngredients((prev) => {
        const existingIndex = prev.findIndex((item) => item.catalogItemId === catalogItem.id);
        if (existingIndex >= 0) {
          return prev.map((item, index) =>
            index === existingIndex
              ? { ...item, quantity: item.quantity + quantity, unit }
              : item,
          );
        }

        return [
          ...prev,
          {
            catalogItemId: catalogItem.id,
            name: catalogItem.name,
            category: resolveCategoryForUser(catalogItem),
            quantity,
            unit,
          },
        ];
      });

      setRecipeIngredientInput("");
    },
    [resolveCategoryForUser],
  );

  const addRecipeDraftIngredient = useCallback(() => {
    if (!recipeIngredientInput.trim()) {
      pushToast("Skriv en ingrediens först.");
      return;
    }

    const parsed = parseShoppingInput(recipeIngredientInput);
    if (!parsed.query.trim()) {
      pushToast("Skriv ett ingrediensnamn.");
      return;
    }
    const topSuggestion = getSuggestions(parsed.query, db.catalog)[0];

    if (!topSuggestion) {
      setPendingRecipeIngredient({
        name: parsed.query.trim(),
        quantity: Math.max(0.01, parsed.quantity ?? 1),
        unit: "st",
        category: DEFAULT_CATEGORIES[0],
      });
      return;
    }

    addRecipeIngredientFromCatalog(topSuggestion, parsed.quantity);
  }, [addRecipeIngredientFromCatalog, db.catalog, pushToast, recipeIngredientInput]);

  const confirmCreateRecipeIngredient = useCallback(() => {
    if (!pendingRecipeIngredient) {
      return;
    }

    const ingredientName = pendingRecipeIngredient.name.trim();
    if (!ingredientName) {
      pushToast("Ingrediensnamn saknas.");
      return;
    }

    const quantity = Math.max(0.01, pendingRecipeIngredient.quantity);
    const newCatalogItem: CatalogItem = {
      id: uid(),
      name: ingredientName,
      category: pendingRecipeIngredient.category,
      defaultQuantity: quantity,
      defaultUnit: pendingRecipeIngredient.unit,
      units: [pendingRecipeIngredient.unit, "st", "pkt", "kg", "g", "l", "dl", "ml", "burk"].filter(
        (unit, index, array) => array.indexOf(unit) === index,
      ) as Unit[],
    };

    mutateDb((draft) => {
      draft.catalog.push(newCatalogItem);
    });

    setRecipeDraftIngredients((prev) => [
      ...prev,
      {
        catalogItemId: newCatalogItem.id,
        name: newCatalogItem.name,
        category: newCatalogItem.category,
        quantity,
        unit: pendingRecipeIngredient.unit,
      },
    ]);

    setPendingRecipeIngredient(null);
    setRecipeIngredientInput("");
    pushToast(`Lade till ingrediensen ${newCatalogItem.name}.`);
  }, [mutateDb, pendingRecipeIngredient, pushToast]);

  const removeRecipeDraftIngredient = useCallback((catalogItemId: string) => {
    setRecipeDraftIngredients((prev) => prev.filter((item) => item.catalogItemId !== catalogItemId));
  }, []);

  const handleRecipeImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setRecipeImageDataUrl(result);
      }
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }, []);

  const createRecipe = useCallback(() => {
    if (!currentUser || !activeHousehold) {
      return;
    }

    const title = recipeTitle.trim();
    if (!title) {
      pushToast("Skriv ett receptnamn.");
      return;
    }

    if (!recipeDraftIngredients.length) {
      pushToast("Lägg till minst en ingrediens.");
      return;
    }

    mutateDb((draft) => {
      draft.recipes.unshift({
        id: uid(),
        householdId: activeHousehold.id,
        title,
        description: recipeDescription.trim(),
        ingredients: recipeDraftIngredients,
        imageDataUrl: recipeImageDataUrl,
      });

      addActivity(draft, {
        type: "recipe_created",
        householdId: activeHousehold.id,
        message: `${currentUser.firstName} lade till receptet ${title}`,
      });
    });

    setRecipeTitle("");
    setRecipeDescription("");
    setRecipeImageDataUrl(undefined);
    setRecipeIngredientInput("");
    setRecipeDraftIngredients([]);
    pushToast("Receptet är sparat.");
  }, [
    activeHousehold,
    addActivity,
    currentUser,
    mutateDb,
    pushToast,
    recipeDescription,
    recipeDraftIngredients,
    recipeImageDataUrl,
    recipeTitle,
  ]);

  const removeRecipe = useCallback(
    (recipeId: string) => {
      mutateDb((draft) => {
        draft.recipes = draft.recipes.filter((recipe) => recipe.id !== recipeId);
      });

      setSelectedRecipeIngredients((prev) => {
        const next = { ...prev };
        delete next[recipeId];
        return next;
      });
      setRecipeTargetListByRecipeId((prev) => {
        const next = { ...prev };
        delete next[recipeId];
        return next;
      });

      pushToast("Recept borttaget.");
    },
    [mutateDb, pushToast],
  );

  const toggleRecipeIngredient = useCallback((recipeId: string, ingredientId: string) => {
    setSelectedRecipeIngredients((prev) => {
      const current = new Set(prev[recipeId] ?? []);
      if (current.has(ingredientId)) {
        current.delete(ingredientId);
      } else {
        current.add(ingredientId);
      }

      return {
        ...prev,
        [recipeId]: [...current],
      };
    });
  }, []);

  const toggleAllRecipeIngredients = useCallback((recipe: Recipe) => {
    setSelectedRecipeIngredients((prev) => {
      const current = new Set(prev[recipe.id] ?? []);
      const ingredientIds = recipe.ingredients.map((ingredient) => ingredient.catalogItemId);
      const allSelected = ingredientIds.length > 0 && ingredientIds.every((ingredientId) => current.has(ingredientId));

      return {
        ...prev,
        [recipe.id]: allSelected ? [] : ingredientIds,
      };
    });
  }, []);

  const addSelectedRecipeItems = useCallback(
    (recipe: Recipe, shoppingListIdOverride?: string | null) => {
      const selected = new Set(selectedRecipeIngredients[recipe.id] ?? []);
      if (!selected.size) {
        pushToast("Välj minst en ingrediens.");
        return;
      }

      const shoppingListId = shoppingListIdOverride ?? activeShoppingListId;
      if (!shoppingListId) {
        pushToast("Välj vilken inköpslista ingredienserna ska läggas i.");
        return;
      }

      recipe.ingredients.forEach((ingredient) => {
        if (!selected.has(ingredient.catalogItemId)) {
          return;
        }

        const catalogItem = db.catalog.find((item) => item.id === ingredient.catalogItemId);
        if (!catalogItem) {
          return;
        }

        addShoppingFromCatalog(catalogItem, ingredient.quantity, ingredient.unit, undefined, shoppingListId);
      });

      const shoppingListName = shoppingListsForDwelling.find((list) => list.id === shoppingListId)?.name ?? "vald lista";
      pushToast(`Lade till valda ingredienser från ${recipe.title} i ${shoppingListName}.`);
    },
    [
      activeShoppingListId,
      addShoppingFromCatalog,
      db.catalog,
      pushToast,
      selectedRecipeIngredients,
      shoppingListsForDwelling,
    ],
  );

  const createTodo = useCallback(() => {
    if (!currentUser || !activeHousehold) {
      return;
    }

    const title = todoTitle.trim();
    if (!title) {
      pushToast("Skriv en uppgiftstitel.");
      return;
    }

    let recurrence: Recurrence = { type: "once" };
    if (todoRecurrenceType === "weekly") {
      recurrence = { type: "weekly", weekday: new Date().getDay() };
    } else if (todoRecurrenceType === "biweekly") {
      recurrence = { type: "biweekly", weekday: new Date().getDay() };
    } else if (todoRecurrenceType === "monthly") {
      recurrence = { type: "monthly", mode: todoMonthlyMode, day: todoMonthlyMode === "date" ? new Date().getDate() : undefined };
    } else if (todoRecurrenceType === "yearly") {
      recurrence = { type: "yearly" };
    } else if (todoRecurrenceType === "custom") {
      recurrence = { type: "custom", interval: Math.max(1, todoCustomInterval), unit: todoCustomUnit };
    }

    mutateDb((draft) => {
      draft.todos.push({
        id: uid(),
        householdId: activeHousehold.id,
        dwellingId: todoDwellingId || undefined,
        title,
        note: todoNote.trim() || undefined,
        dueDate: todoDueDate || undefined,
        assignee: todoAssignee,
        status: "active",
        recurrence,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: currentUser.id,
      });

      addActivity(draft, {
        type: "todo_created",
        householdId: activeHousehold.id,
        dwellingId: todoDwellingId || undefined,
        message: `${currentUser.firstName} lade till to-do: ${title}`,
      });
    });

    setTodoTitle("");
    setTodoNote("");
    setTodoDueDate("");
    setTodoAssignee("none");
    setTodoDwellingId("");
    setTodoRecurrenceType("once");
    setTodoMonthlyMode("date");
    setTodoCustomInterval(3);
    setTodoCustomUnit("day");

    pushToast("Uppgiften är sparad.");
  }, [
    activeHousehold,
    addActivity,
    currentUser,
    mutateDb,
    pushToast,
    todoAssignee,
    todoCustomInterval,
    todoCustomUnit,
    todoDueDate,
    todoDwellingId,
    todoMonthlyMode,
    todoNote,
    todoRecurrenceType,
    todoTitle,
  ]);

  const completeTodo = useCallback(
    (todo: Todo) => {
      if (!currentUser) {
        return;
      }

      mutateDb((draft) => {
        const target = draft.todos.find((item) => item.id === todo.id);
        if (!target) {
          return;
        }

        target.status = "done";
        target.completedAt = Date.now();
        target.updatedAt = Date.now();
        target.updatedBy = currentUser.id;

        addActivity(draft, {
          type: "todo_completed",
          householdId: todo.householdId,
          dwellingId: todo.dwellingId,
          message: `${currentUser.firstName} slutförde to-do: ${todo.title}`,
        });

        if (todo.recurrence.type !== "once") {
          const nextDueDate = computeNextDueDate(todo);
          draft.todos.push({
            ...target,
            id: uid(),
            status: "active",
            dueDate: nextDueDate,
            completedAt: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

      pushToast(`Klar. Nästa: ${formatDate(nextDueDate)}`);
        }
      });
    },
    [addActivity, currentUser, mutateDb, pushToast],
  );

  const reopenTodo = useCallback(
    (todoId: string) => {
      if (!currentUser) {
        return;
      }

      mutateDb((draft) => {
        const target = draft.todos.find((item) => item.id === todoId);
        if (!target) {
          return;
        }

        target.status = "active";
        target.completedAt = undefined;
        target.updatedAt = Date.now();
        target.updatedBy = currentUser.id;
      });
    },
    [currentUser, mutateDb],
  );

  const addDwelling = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!activeHousehold || !newDwellingName.trim() || !newDwellingIcon.trim()) {
        pushToast("Fyll i namn och ikon för boendet.");
        return;
      }

      const dwelling: Dwelling = {
        id: uid(),
        householdId: activeHousehold.id,
        name: newDwellingName.trim(),
        icon: newDwellingIcon.trim(),
        accentColor: newDwellingAccent,
        createdAt: Date.now(),
      };

      mutateDb((draft) => {
        draft.dwellings.push(dwelling);
      });

      mutateSession((prev) => ({
        ...prev,
        activeDwellingId: dwelling.id,
      }));

      setNewDwellingName("");
      setNewDwellingIcon("");
      setNewDwellingAccent("#2f6048");
      pushToast(`Nu är du i ${dwelling.name}`);
    },
    [activeHousehold, mutateDb, mutateSession, newDwellingAccent, newDwellingIcon, newDwellingName, pushToast],
  );

  const startEditDwelling = useCallback((dwelling: Dwelling) => {
    setEditingDwellingId(dwelling.id);
    setEditingDwellingName(dwelling.name);
    setEditingDwellingIcon(dwelling.icon);
    setEditingDwellingAccent(dwelling.accentColor ?? "#2f6048");
  }, []);

  const saveDwellingEdit = useCallback(() => {
    if (!editingDwellingId) {
      return;
    }

    const nextName = editingDwellingName.trim();
    const nextIcon = editingDwellingIcon.trim();
    if (!nextName || !nextIcon) {
      pushToast("Namn och ikon krävs för boendet.");
      return;
    }

    mutateDb((draft) => {
      const dwelling = draft.dwellings.find((item) => item.id === editingDwellingId);
      if (!dwelling) {
        return;
      }

      dwelling.name = nextName;
      dwelling.icon = nextIcon;
      dwelling.accentColor = editingDwellingAccent;
    });

    setEditingDwellingId(null);
    setEditingDwellingName("");
    setEditingDwellingIcon("");
    setEditingDwellingAccent("#2f6048");
    pushToast("Boendet uppdaterades.");
  }, [
    editingDwellingAccent,
    editingDwellingIcon,
    editingDwellingId,
    editingDwellingName,
    mutateDb,
    pushToast,
  ]);

  const cancelDwellingEdit = useCallback(() => {
    setEditingDwellingId(null);
    setEditingDwellingName("");
    setEditingDwellingIcon("");
    setEditingDwellingAccent("#2f6048");
  }, []);

  const deleteDwelling = useCallback(
    (dwellingId: string) => {
      const targetDwelling = db.dwellings.find((dwelling) => dwelling.id === dwellingId);
      if (!targetDwelling || !activeHousehold) {
        return;
      }

      const shouldDelete = window.confirm(
        `Radera boendet "${targetDwelling.name}"? Listor, to-do och historik för boendet tas bort.`,
      );
      if (!shouldDelete) {
        return;
      }

      const remainingDwellings = db.dwellings.filter(
        (dwelling) => dwelling.householdId === activeHousehold.id && dwelling.id !== dwellingId,
      );
      const nextDwellingId = session.activeDwellingId === dwellingId ? (remainingDwellings[0]?.id ?? null) : session.activeDwellingId;

      mutateDb((draft) => {
        draft.dwellings = draft.dwellings.filter((dwelling) => dwelling.id !== dwellingId);
        draft.shoppingLists = draft.shoppingLists.filter((list) => list.dwellingId !== dwellingId);
        draft.shopping = draft.shopping.filter((item) => item.dwellingId !== dwellingId);
        draft.presets = draft.presets.filter((preset) => preset.dwellingId !== dwellingId);
        draft.todos = draft.todos.filter((todo) => todo.dwellingId !== dwellingId);
        draft.categoryOrders = draft.categoryOrders.filter((entry) => entry.dwellingId !== dwellingId);
        draft.learning = draft.learning.filter((entry) => entry.dwellingId !== dwellingId);
        draft.activity = draft.activity.filter((entry) => entry.dwellingId !== dwellingId);
      });

      mutateSession((prev) => ({
        ...prev,
        activeDwellingId: nextDwellingId,
      }));

      if (editingDwellingId === dwellingId) {
        cancelDwellingEdit();
      }
      if (activeDwelling?.id === dwellingId) {
        setActiveShoppingListId(null);
      }
      pushToast(`Boendet ${targetDwelling.name} är raderat.`);
    },
    [
      activeDwelling?.id,
      activeHousehold,
      cancelDwellingEdit,
      db.dwellings,
      editingDwellingId,
      mutateDb,
      mutateSession,
      pushToast,
      session.activeDwellingId,
    ],
  );

  const switchDwelling = useCallback(
    (dwellingId: string) => {
      const found = db.dwellings.find((dwelling) => dwelling.id === dwellingId);
      if (!found) {
        return;
      }

      mutateSession((prev) => ({
        ...prev,
        activeDwellingId: dwellingId,
      }));
      pushToast(`Nu är du i ${found.name}`);
    },
    [db.dwellings, mutateSession, pushToast],
  );

  const toggleDailySummary = useCallback(() => {
    if (!currentUser) {
      return;
    }

    mutateDb((draft) => {
      const setting = draft.settings.find((item) => item.userId === currentUser.id);
      if (!setting) {
        draft.settings.push({
          id: uid(),
          userId: currentUser.id,
          dailySummaryEnabled: false,
          categoryOverrides: {},
        });
        return;
      }

      setting.dailySummaryEnabled = !setting.dailySummaryEnabled;
    });
  }, [currentUser, mutateDb]);

  const deleteActiveHousehold = useCallback(() => {
    if (!activeHousehold || !currentUser) {
      return;
    }

    const shouldDelete = window.confirm(
      `Radera hushållet "${activeHousehold.name}"? Alla listor, to-do och aktiviteter i hushållet tas bort.`,
    );
    if (!shouldDelete) {
      return;
    }

    const remainingHouseholds = myHouseholds.filter((household) => household.id !== activeHousehold.id);
    const nextHousehold = remainingHouseholds[0] ?? null;
    const nextDwelling = nextHousehold
      ? db.dwellings.find((dwelling) => dwelling.householdId === nextHousehold.id) ?? null
      : null;

    mutateDb((draft) => {
      const dwellingIds = new Set(
        draft.dwellings
          .filter((dwelling) => dwelling.householdId === activeHousehold.id)
          .map((dwelling) => dwelling.id),
      );

      draft.households = draft.households.filter((household) => household.id !== activeHousehold.id);
      draft.dwellings = draft.dwellings.filter((dwelling) => !dwellingIds.has(dwelling.id));
      draft.shoppingLists = draft.shoppingLists.filter(
        (list) => list.householdId !== activeHousehold.id && !dwellingIds.has(list.dwellingId),
      );
      draft.shopping = draft.shopping.filter(
        (item) => item.householdId !== activeHousehold.id && !dwellingIds.has(item.dwellingId),
      );
      draft.presets = draft.presets.filter(
        (preset) => preset.householdId !== activeHousehold.id && !dwellingIds.has(preset.dwellingId),
      );
      draft.recipes = draft.recipes.filter((recipe) => recipe.householdId !== activeHousehold.id);
      draft.todos = draft.todos.filter((todo) => todo.householdId !== activeHousehold.id);
      draft.categoryOrders = draft.categoryOrders.filter((entry) => !dwellingIds.has(entry.dwellingId));
      draft.learning = draft.learning.filter((entry) => !dwellingIds.has(entry.dwellingId));
      draft.activity = draft.activity.filter((entry) => entry.householdId !== activeHousehold.id);
    });

    mutateSession((prev) => ({
      ...prev,
      activeHouseholdId: nextHousehold?.id ?? null,
      activeDwellingId: nextDwelling?.id ?? null,
    }));
    setActiveShoppingListId(null);
    pushToast(`Hushållet ${activeHousehold.name} är raderat.`);
  }, [activeHousehold, currentUser, db.dwellings, mutateDb, mutateSession, myHouseholds, pushToast]);

  const logout = useCallback(() => {
    const nextSession = { ...DEFAULT_SESSION };
    const nextDb = createDefaultDb();
    setLogoutPending(true);
    setAuthUser(null);
    setDb(nextDb);
    saveDb(nextDb);
    setSession(nextSession);
    saveSession(nextSession);
    setActiveShoppingListId(null);
    setAuthMode("login");
    setLoginPassword("");
    setReady(true);
    if (!supabase) {
      setLogoutPending(false);
      return;
    }

    void supabase.auth
      .signOut({ scope: "local" })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to sign out", error);
        }

        setLogoutPending(false);
      })
      .catch((error) => {
        console.error("Failed to sign out", error);
      });
  }, [saveDb, saveSession, supabase]);

  const inviteFromUrl = useMemo(() => extractToken(initialJoinToken ?? ""), [initialJoinToken]);

  const retryCloudBootstrap = useCallback(() => {
    setCloudLoadError(null);
    setCloudHydrated(false);
    window.location.replace(`${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (ready && inviteFromUrl && currentUser && myHouseholds.length === 0) {
      setJoinTokenInput(inviteFromUrl);
    }
  }, [currentUser, inviteFromUrl, myHouseholds.length, ready]);

  const overviewDwellings = useMemo(() => {
    if (!activeHousehold) {
      return [];
    }

    return db.dwellings
      .filter((dwelling) => dwelling.householdId === activeHousehold.id)
      .map((dwelling) => ({
        ...dwelling,
        remaining: db.shopping.filter((item) => item.dwellingId === dwelling.id && !item.checked).length,
      }));
  }, [activeHousehold, db.dwellings, db.shopping]);

  const visibleActivities = useMemo(() => {
    if (!activeHousehold) {
      return [];
    }

    return db.activity
      .filter(
        (item) =>
          item.householdId === activeHousehold.id &&
          VISIBLE_ACTIVITY_TYPES.includes(item.type),
      )
      .slice(0, 12);
  }, [activeHousehold, db.activity]);

  const shoppingSuggestions = useMemo(() => {
    const parsed = parseShoppingInput(shoppingInput);
    if (!parsed.query.trim()) {
      return [];
    }

    return getSuggestions(parsed.query, db.catalog);
  }, [db.catalog, shoppingInput]);

  const recipeIngredientSuggestions = useMemo(() => {
    const parsed = parseShoppingInput(recipeIngredientInput);
    if (!parsed.query.trim()) {
      return [];
    }

    return getSuggestions(parsed.query, db.catalog);
  }, [db.catalog, recipeIngredientInput]);

  const sortedCatalog = useMemo(
    () =>
      [...db.catalog]
        .filter((item) =>
          !catalogSearch.trim()
            ? true
            : normalizeText(item.name).includes(normalizeText(catalogSearch)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "sv-SE")),
    [catalogSearch, db.catalog],
  );

  const visibleRecipes = useMemo(() => {
    if (!activeHousehold) {
      return [];
    }

    return db.recipes.filter((recipe) => !recipe.householdId || recipe.householdId === activeHousehold.id);
  }, [activeHousehold, db.recipes]);

  if (!ready) {
    return <main className="app-shell loading-shell">Laddar Domus...</main>;
  }

  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark compact">
              <Image src="/icons/logotype.png" alt="Domus logotyp" width={72} height={72} className="brand-logo" priority />
            </div>
            <div className="auth-copy">
              <p className="eyebrow">{cloudLive ? "Live redo" : "Lokal testmiljö"}</p>
              <h1>Domus</h1>
              <p>Delat hushåll, live-listor och en lugnare vardag i samma app.</p>
            </div>
          </div>

          <div className="auth-toggle">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Logga in
            </button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
              Skapa konto
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={login} className="stack auth-form">
              <label>
                E-post
                <input
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Lösenord
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="auth-submit">Logga in</button>
            </form>
          ) : (
            <form onSubmit={signup} className="stack auth-form">
              <label>
                Förnamn
                <input
                  value={signupFirstName}
                  onChange={(event) => setSignupFirstName(event.target.value)}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label>
                Efternamn
                <input
                  value={signupLastName}
                  onChange={(event) => setSignupLastName(event.target.value)}
                  autoComplete="family-name"
                  required
                />
              </label>
              <label>
                E-post
                <input
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Lösenord
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button type="submit" className="auth-submit">Skapa konto</button>
            </form>
          )}

          {inviteFromUrl ? <p className="small">Inbjudan hittad. Efter inloggning kan du gå med i hushållet.</p> : null}
        </section>

        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
        />
      </main>
    );
  }

  if (supabase && cloudLoadError) {
    return (
      <main className="auth-shell">
        <section className="auth-card wide">
          <div className="auth-brand">
            <div className="auth-copy">
              <p className="eyebrow">Cloud-fel</p>
              <h1>Kunde inte ladda hushållet</h1>
              <p>{cloudLoadError}</p>
            </div>
            <span className="stat-pill">Ingen data har skrivits över</span>
          </div>
          <div className="split-grid">
            <div className="stack card-block">
              <h2>Försök igen</h2>
              <p className="small">Ladda om cloud-data innan du skapar eller går med i ett nytt hushåll.</p>
              <button type="button" onClick={retryCloudBootstrap}>Ladda om cloud</button>
            </div>
            <div className="stack card-block">
              <h2>Konto</h2>
              <p className="small">{currentUser?.email ?? "Ingen e-post"}</p>
              <button type="button" className="ghost subtle" onClick={logout}>Logga ut</button>
            </div>
          </div>
        </section>

        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
        />
      </main>
    );
  }

  if (supabase && !cloudHydrated) {
    return <main className="app-shell loading-shell">Synkar hushallet...</main>;
  }

  if (myHouseholds.length === 0) {
    return (
      <main className="auth-shell">
        <section className="auth-card wide">
          <div className="auth-brand">
            <div className="auth-copy">
            <p className="eyebrow">Hej {currentUser?.firstName ?? "användare"}</p>
              <h1>Skapa ditt hushåll</h1>
              <p>Starta ett nytt hem eller anslut via länk för att testa delad realtime direkt.</p>
            </div>
            <span className="stat-pill">{cloudLive ? "Synkad via cloud" : "Lokal demo"}</span>
          </div>
          <div className="split-grid">
            <form onSubmit={createHousehold} className="stack card-block">
              <h2>Nytt hushåll</h2>
              <label>
                Namn på hushåll
                <input
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                  required
                />
              </label>
              <button type="submit">Skapa hushåll</button>
            </form>

            <div className="stack card-block">
              <h2>Gå med via länk</h2>
              <label>
                Token eller länk
                <input value={joinTokenInput} onChange={(event) => setJoinTokenInput(event.target.value)} />
              </label>
              <button onClick={() => joinByToken(joinTokenInput)}>Gå med</button>
            </div>
          </div>
        </section>

        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
        />
      </main>
    );
  }

  const activeDwellings = db.dwellings.filter((dwelling) => dwelling.householdId === activeHousehold?.id);

  const activeTodos = householdTodos.filter((todo) => todo.status === "active");
  const doneTodos = householdTodos.filter((todo) => todo.status === "done");

  return (
    <main className="app-shell">
      <header className="hero-shell">
        <div className="hero-brand">
          <div className="brand-mark">
            <Image src="/icons/logotype.png" alt="Domus logotyp" width={132} height={132} className="brand-logo" priority />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">{cloudLive ? "Live sync aktiv" : "Lokal testkopia"}</p>
            <h1>{activeHousehold?.name ?? "Domus"}</h1>
            <p className="hero-text">
              Inköp, recept och to-do för {activeDwelling?.name ?? "ditt hem"} i en tydlig arbetsyta.
            </p>
            <div className="hero-meta">
              <span className="stat-pill">{householdMembers.length} medlemmar</span>
              <span className="stat-pill">{overviewDwellings.length} boenden</span>
              <span className="stat-pill">
                {unpickedItems.length} att handla
              </span>
            </div>
          </div>
        </div>

        <div className="hero-toolbar">
          <label className="control-card dwelling-switcher">
            <span>Boende</span>
            <select
              value={activeDwelling?.id ?? ""}
              onChange={(event) => switchDwelling(event.target.value)}
            >
              {activeDwellings.map((dwelling) => (
                <option key={dwelling.id} value={dwelling.id}>
                  {dwelling.icon} {dwelling.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="account-menu-wrap account-menu-floating" ref={accountMenuRef}>
        <button
          type="button"
          className="account-avatar-button"
          onClick={() => setShowAccountMenu((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={showAccountMenu}
          aria-controls="account-menu"
        >
          {accountInitials}
        </button>
        {showAccountMenu ? (
          <div id="account-menu" className="account-dropdown" role="menu">
            <div className="account-dropdown-info">
              <strong>{accountDisplayName}</strong>
              <p className="small">{currentUser?.email}</p>
            </div>
            <button
              type="button"
              className="ghost subtle"
              onClick={() => {
                setShowAccountMenu(false);
                setTab("settings");
              }}
            >
              Inställningar
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => {
                setShowAccountMenu(false);
                logout();
              }}
            >
              Logga ut
            </button>
          </div>
        ) : null}
      </div>

      <section className="command-strip">
        <nav className="tab-row">
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="quick-summary">
          <span className="stat-pill">{activeDwelling?.icon} {activeDwelling?.name ?? "Inget boende"}</span>
          <span className="stat-pill">{cloudLive ? "Cloud live" : "Lokal fallback"}</span>
        </div>
      </section>

      {tab === "overview" ? (
        <section className="content-grid">
          <article className="panel full status-panel">
            <div className="section-head">
              <div>
                <h2>Status</h2>
                <p className="small">Det viktiga just nu i hushållet.</p>
              </div>
              <span className="stat-pill">{activeDwelling?.icon} {activeDwelling?.name ?? "Alla boenden"}</span>
            </div>
            <div className="status-grid">
              <button
                type="button"
                className="status-metric status-metric-action"
                onClick={openLatestShoppingList}
              >
                <span>Att handla</span>
                <strong>{unpickedItems.length}</strong>
              </button>
              <button
                type="button"
                className="status-metric status-metric-action"
                onClick={openTodo}
              >
                <span>To-do aktiva</span>
                <strong>{todoStats.total}</strong>
              </button>
              <button
                type="button"
                className="status-metric status-metric-action"
                onClick={openTodo}
              >
                <span>Förfaller idag</span>
                <strong>{todoStats.dueToday}</strong>
              </button>
              <button
                type="button"
                className="status-metric status-metric-action"
                onClick={openTodo}
              >
                <span>Försenade</span>
                <strong>{todoStats.overdue}</strong>
              </button>
            </div>
            <div className="members">
              {householdMembers.map((member) => (
                <span key={member.id}>{member.firstName}</span>
              ))}
            </div>
          </article>

          <article className="panel">
            <h2>Boenden</h2>
            <div className="card-grid">
              {overviewDwellings.map((dwelling) => (
                <button
                  key={dwelling.id}
                  className="dwelling-card"
                  style={{ borderColor: dwelling.accentColor ?? "#2f6048" }}
                  onClick={() => switchDwelling(dwelling.id)}
                >
                  <strong>
                    {dwelling.icon} {dwelling.name}
                  </strong>
                  <span>{dwelling.remaining} kvar att handla</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel full">
            <h2>Senaste händelser</h2>
            {!visibleActivities.length ? <p>Ingen aktivitet än så länge.</p> : null}
            <ul className="list">
              {visibleActivities.map((item) => (
                <li key={item.id}>
                  <span>{item.message}</span>
                  <time>{formatDateTime(item.createdAt)}</time>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      {tab === "shopping" ? (
        <section className="content-grid">
          <article className="panel full">
            <h2>Inköp i {activeDwelling?.name}</h2>
            <p className="small">Skriv en vara, tryck Enter så läggs översta förslaget till direkt.</p>
            <div className="shopping-meta">
              <label>
                Välj inköpslista
                <select
                  value={activeShoppingListId ?? ""}
                  onChange={(event) => setActiveShoppingListId(event.target.value || null)}
                >
                  <option value="">Ingen vald</option>
                  {shoppingListsForDwelling.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ghost" onClick={() => setPendingNewList({ name: "Inköpslista" })}>
                Ny lista
              </button>
              <button
                className="ghost danger"
                onClick={deleteActiveShoppingList}
                disabled={!activeShoppingList}
                title={activeShoppingList ? `Radera ${activeShoppingList.name}` : "Välj en lista först"}
              >
                Radera lista
              </button>
            </div>
            <div className="shopping-add">
              <input
                value={shoppingInput}
                onChange={(event) => setShoppingInput(event.target.value)}
                placeholder="Ex: banan 10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddShopping();
                  }
                }}
              />
              <button onClick={handleAddShopping}>Lägg till</button>
            </div>
            {shoppingInput.trim() && shoppingSuggestions.length ? (
              <ul className="suggestions">
                {shoppingSuggestions.map((item, index) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        const parsed = parseShoppingInput(shoppingInput);
                        if (!activeShoppingListId) {
                          setPendingNewList({
                            name: "Inköpslista",
                            pendingInput: `${item.name}${parsed.quantity ? ` ${parsed.quantity}` : ""}`,
                          });
                          return;
                        }
                        addShoppingFromCatalog(item, parsed.quantity, undefined, undefined, activeShoppingListId);
                        setShoppingInput("");
                      }}
                    >
                      <strong>{index === 0 ? "Enter → " : ""}{item.name}</strong>
                      <span>{item.defaultQuantity} {item.defaultUnit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="row-actions">
              <button className="ghost danger" onClick={clearShoppingList}>
                Rensa hela inköpslistan
              </button>
              <button className="ghost" onClick={openCategoryOrganizer}>
                Ordna kategorier
              </button>
              <button className="ghost" onClick={() => setTab("catalog")}>
                Varubibliotek
              </button>
            </div>
            {!activeShoppingListId ? <p className="small">Välj eller skapa en inköpslista för att lägga till varor.</p> : null}
          </article>

          <article className="panel full">
            <h2>Att handla</h2>
            {!shoppingByCategory.length ? <p>Listan är tom just nu.</p> : null}
            {shoppingByCategory.map((group, index) => (
              <div key={`${group.category}-${index}`} className="category-group">
                <h3>{group.category}</h3>
                <ul className="list">
                  {group.items.map((item) => (
                    <li key={item.id} className="shopping-row">
                      <button className="check" onClick={() => toggleShoppingChecked(item.id)} aria-label="Markera plockad">
                        ◯
                      </button>
                      <span className="item-name">{item.name}</span>

                      <div className="quantity-controls">
                        <button
                          className="step-btn"
                          onClick={() => adjustShoppingQuantity(item.id, -1)}
                          aria-label={`Minska ${item.name}`}
                        >
                          -
                        </button>
                        {editingItemId === item.id ? (
                          <span
                            className="inline-edit"
                            tabIndex={-1}
                            onBlur={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                saveInlineEdit();
                              }
                            }}
                          >
                            <input
                              autoFocus
                              value={editQuantity}
                              onChange={(event) => setEditQuantity(event.target.value)}
                              inputMode="decimal"
                            />
                            <select value={editUnit} onChange={(event) => setEditUnit(event.target.value as Unit)}>
                              {(db.catalog.find((entry) => entry.id === item.catalogItemId)?.units ?? [item.unit]).map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </span>
                        ) : (
                          <button
                            className="quantity"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditQuantity(String(item.quantity));
                              setEditUnit(item.unit);
                            }}
                          >
                            {item.quantity} {item.unit}
                          </button>
                        )}
                        <button
                          className="step-btn"
                          onClick={() => adjustShoppingQuantity(item.id, 1)}
                          aria-label={`Öka ${item.name}`}
                        >
                          +
                        </button>
                      </div>

                      <button className="danger ghost" onClick={() => removeShoppingItem(item)}>
                        Ta bort
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {activeShoppingList && pickedItems.length > 0 && unpickedItems.length === 0 ? (
              <div className="completion-actions">
                <p>Listan är klar. Vill du arkivera eller radera listan?</p>
                <div className="row-actions">
                  <button className="ghost" onClick={archiveActiveShoppingList}>
                    Arkivera lista
                  </button>
                  <button className="ghost danger" onClick={deleteActiveShoppingList}>
                    Radera lista
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="panel full">
            <button className="collapse" onClick={() => setPickedOpen((prev) => !prev)}>
              {pickedOpen ? "Dölj" : "Visa"} plockat ({pickedItems.length})
            </button>
            {pickedOpen ? (
              <ul className="list">
                {pickedItems.map((item) => (
                  <li key={item.id} className="shopping-row">
                    <button className="check done" onClick={() => toggleShoppingChecked(item.id)} aria-label="Återställ vara">
                      ✓
                    </button>
                    <span className="item-name done">{item.name}</span>
                    <span className="quantity">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </section>
      ) : null}

      {tab === "recipes" ? (
        <section className="content-grid">
          <article className="panel full">
            <h2>Nytt recept</h2>
            <p className="small">Skriv ingrediens så visas förslag direkt. Saknas den kan du lägga till den.</p>
            <div className="todo-form">
              <label>
                Receptnamn
                <input
                  value={recipeTitle}
                  onChange={(event) => setRecipeTitle(event.target.value)}
                  placeholder="Ex: Fisksoppa"
                />
              </label>
              <label>
                Beskrivning
                <input
                  value={recipeDescription}
                  onChange={(event) => setRecipeDescription(event.target.value)}
                  placeholder="Valfritt"
                />
              </label>
            </div>

            <div className="recipe-image-actions">
              <button className="ghost" onClick={() => setShowRecipeImagePicker(true)}>
                Lägg till omslagsbild
              </button>
              {recipeImageDataUrl ? (
                <button className="ghost danger" onClick={() => setRecipeImageDataUrl(undefined)}>
                  Ta bort omslagsbild
                </button>
              ) : null}
              <input
                ref={recipeAlbumInputRef}
                type="file"
                accept="image/*"
                onChange={handleRecipeImageChange}
                className="sr-only-input"
                aria-hidden="true"
                tabIndex={-1}
              />
              <input
                ref={recipeCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleRecipeImageChange}
                className="sr-only-input"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>

            {recipeImageDataUrl ? (
              <div className="recipe-cover-frame">
                <Image
                  className="recipe-cover"
                  src={recipeImageDataUrl}
                  alt="Förhandsvisning recept"
                  width={960}
                  height={540}
                  unoptimized
                />
              </div>
            ) : null}

            <div className="shopping-add">
              <input
                value={recipeIngredientInput}
                onChange={(event) => setRecipeIngredientInput(event.target.value)}
                placeholder="Ingrediens, t.ex. mjölk 2"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addRecipeDraftIngredient();
                  }
                }}
              />
              <button onClick={addRecipeDraftIngredient}>Lägg till ingrediens</button>
            </div>
            {recipeIngredientInput.trim() && recipeIngredientSuggestions.length ? (
              <ul className="suggestions">
                {recipeIngredientSuggestions.map((item, index) => (
                  <li key={`recipe-${item.id}`}>
                    <button
                      onClick={() => {
                        const parsed = parseShoppingInput(recipeIngredientInput);
                        addRecipeIngredientFromCatalog(item, parsed.quantity);
                      }}
                    >
                      <strong>{index === 0 ? "Enter → " : ""}{item.name}</strong>
                      <span>{item.defaultQuantity} {item.defaultUnit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {recipeIngredientInput.trim() && !recipeIngredientSuggestions.length ? (
              <p className="small">Ingen träff. Tryck Lägg till ingrediens för att lägga till den som ny vara.</p>
            ) : null}

            <ul className="list compact">
              {recipeDraftIngredients.map((ingredient) => (
                <li key={ingredient.catalogItemId}>
                  <span>
                    {ingredient.name} {ingredient.quantity} {ingredient.unit}
                  </span>
                  <button className="ghost danger" onClick={() => removeRecipeDraftIngredient(ingredient.catalogItemId)}>
                    Ta bort
                  </button>
                </li>
              ))}
            </ul>

            <button onClick={createRecipe}>Spara recept</button>
          </article>

          {!visibleRecipes.length ? <article className="panel full"><p>Inga recept ännu.</p></article> : null}
          {visibleRecipes.map((recipe) => {
            const selected = new Set(selectedRecipeIngredients[recipe.id] ?? []);
            const recipeTargetListId = recipeTargetListByRecipeId[recipe.id] ?? activeShoppingListId ?? "";
            const allSelected =
              recipe.ingredients.length > 0 &&
              recipe.ingredients.every((ingredient) => selected.has(ingredient.catalogItemId));

            return (
              <article key={recipe.id} className="panel">
                <h2>{recipe.title}</h2>
                {recipe.imageDataUrl ? (
                  <div className="recipe-cover-frame">
                    <Image
                      className="recipe-cover"
                      src={recipe.imageDataUrl}
                      alt={`Omslagsbild för ${recipe.title}`}
                      width={960}
                      height={540}
                      unoptimized
                    />
                  </div>
                ) : null}
                {recipe.description ? <p>{recipe.description}</p> : null}
                <ul className="list compact">
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.catalogItemId}>
                      <label className="recipe-choice">
                        <input
                          type="checkbox"
                          checked={selected.has(ingredient.catalogItemId)}
                          onChange={() => toggleRecipeIngredient(recipe.id, ingredient.catalogItemId)}
                        />
                        <span>
                          {ingredient.name} {ingredient.quantity} {ingredient.unit}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="recipe-actions">
                  <label className="recipe-list-picker">
                    Lägg i lista
                    <select
                      value={recipeTargetListId}
                      onChange={(event) =>
                        setRecipeTargetListByRecipeId((prev) => ({
                          ...prev,
                          [recipe.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Ingen vald</option>
                      {shoppingListsForDwelling.map((list) => (
                        <option key={`recipe-target-${recipe.id}-${list.id}`} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="row-actions">
                  <button onClick={() => toggleAllRecipeIngredients(recipe)}>
                    {allSelected ? "Avmarkera alla" : "Välj alla"}
                  </button>
                  <button onClick={() => addSelectedRecipeItems(recipe, recipeTargetListId || null)}>
                    Lägg till valda i inköpslistan
                  </button>
                  <button className="ghost danger" onClick={() => removeRecipe(recipe.id)}>
                    Ta bort recept
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {tab === "todo" ? (
        <section className="content-grid">
          <article className="panel full">
            <h2>To-do</h2>
            <div className="todo-form">
              <label>
                Titel
                <input value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} placeholder="Ex: Byt filter i tvättmaskin" />
              </label>

              <label>
                Anteckning
                <input value={todoNote} onChange={(event) => setTodoNote(event.target.value)} placeholder="Valfritt" />
              </label>

              <label>
                Förfallodatum
                <input type="date" value={todoDueDate} onChange={(event) => setTodoDueDate(event.target.value)} />
              </label>

              <label>
                Ansvarig
                <select value={todoAssignee} onChange={(event) => setTodoAssignee(event.target.value as Todo["assignee"])}>
                  <option value="none">Ingen</option>
                  <option value="all">Alla</option>
                  {householdMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Boende
                <select value={todoDwellingId} onChange={(event) => setTodoDwellingId(event.target.value)}>
                  <option value="">Global i hushållet</option>
                  {activeDwellings.map((dwelling) => (
                    <option key={dwelling.id} value={dwelling.id}>
                      {dwelling.icon} {dwelling.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Återkommande
                <select
                  value={todoRecurrenceType}
                  onChange={(event) => setTodoRecurrenceType(event.target.value as typeof todoRecurrenceType)}
                >
                  <option value="once">Engång</option>
                  <option value="weekly">Varje vecka</option>
                  <option value="biweekly">Varannan vecka</option>
                  <option value="monthly">Varje månad</option>
                  <option value="yearly">Varje år</option>
                  <option value="custom">Anpassad</option>
                </select>
              </label>

              {todoRecurrenceType === "monthly" ? (
                <label>
                  Månadsregel
                  <select value={todoMonthlyMode} onChange={(event) => setTodoMonthlyMode(event.target.value as "date" | "last") }>
                    <option value="date">Samma datum varje månad</option>
                    <option value="last">Sista dagen varje månad</option>
                  </select>
                </label>
              ) : null}

              {todoRecurrenceType === "custom" ? (
                <label>
                  Anpassad frekvens
                  <div className="inline-grid">
                    <input
                      type="number"
                      min={1}
                      value={todoCustomInterval}
                      onChange={(event) => setTodoCustomInterval(Number(event.target.value))}
                    />
                    <select value={todoCustomUnit} onChange={(event) => setTodoCustomUnit(event.target.value as "day" | "week" | "month") }>
                      <option value="day">dag</option>
                      <option value="week">vecka</option>
                      <option value="month">månad</option>
                    </select>
                  </div>
                </label>
              ) : null}

              <button onClick={createTodo}>Skapa uppgift</button>
            </div>
          </article>

          <article className="panel">
            <h2>Aktiva uppgifter</h2>
            {!activeTodos.length ? <p>Inga aktiva uppgifter.</p> : null}
            <ul className="list">
              {activeTodos.map((todo) => {
                const dwellingName = todo.dwellingId
                  ? db.dwellings.find((dwelling) => dwelling.id === todo.dwellingId)?.name ?? "Boende"
                  : "Hushållet";
                const status = resolveTodoSummary(todo, toISODate(new Date()));

                return (
                  <li key={todo.id}>
                    <div>
                      <strong>{todo.title}</strong>
                      <p className="small">
                        {dwellingName} | {resolveAssigneeLabel(todo.assignee, householdMembers)} | {recurrenceLabel(todo.recurrence)}
                      </p>
                      <p className={`small ${status === "overdue" ? "danger-text" : ""}`}>
                        {status === "today" ? "Förfaller idag" : status === "overdue" ? "Försenad" : "Planerad"} - {formatDate(todo.dueDate)}
                      </p>
                    </div>
                    <button onClick={() => completeTodo(todo)}>Klar</button>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="panel">
            <h2>Klara uppgifter</h2>
            {!doneTodos.length ? <p>Inga klara uppgifter än.</p> : null}
            <ul className="list">
              {doneTodos.map((todo) => (
                <li key={todo.id}>
                  <div>
                    <strong>{todo.title}</strong>
                    <p className="small">Klar {todo.completedAt ? formatDateTime(todo.completedAt) : "nyss"}</p>
                  </div>
                  <button onClick={() => reopenTodo(todo.id)}>Återöppna</button>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      {tab === "catalog" ? (
        <section className="content-grid">
          <article className="panel full">
            <h2>Varubibliotek</h2>
            <p className="small">Biblioteket är gemensamt för alla hushåll du är med i.</p>
            <div className="shopping-add">
              <input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="Sök vara, t.ex. mjölk"
              />
              <button className="ghost" onClick={() => setCatalogSearch("")}>
                Rensa sök
              </button>
            </div>

            <div className="todo-form">
              <label>
                Namn
                <input
                  value={newCatalogName}
                  onChange={(event) => setNewCatalogName(event.target.value)}
                  placeholder="Ex: Diskmedel"
                />
              </label>
              <label>
                Kategori
                <select value={newCatalogCategory} onChange={(event) => setNewCatalogCategory(event.target.value)}>
                  {DEFAULT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Standardantal
                <input
                  value={newCatalogQuantity}
                  onChange={(event) => setNewCatalogQuantity(event.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                Enhet
                <select value={newCatalogUnit} onChange={(event) => setNewCatalogUnit(event.target.value as Unit)}>
                  {(["st", "pkt", "kg", "g", "l", "dl", "ml", "burk"] as Unit[]).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={addCatalogItemFromSettings}>Lägg till vara</button>
            </div>

            <ul className="list compact">
              {sortedCatalog.map((item) => {
                const personalCategory = activeSetting?.categoryOverrides?.[item.id] ?? item.category;
                return (
                  <li key={item.id} className="catalog-row">
                    <input
                      value={item.name}
                      onChange={(event) => updateCatalogItem(item.id, { name: event.target.value })}
                      aria-label={`Namn för ${item.name}`}
                    />
                    <input
                      value={catalogDefaultDrafts[item.id]?.quantity ?? String(item.defaultQuantity)}
                      onChange={(event) =>
                        setCatalogDefaultDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            quantity: event.target.value,
                            unit: prev[item.id]?.unit ?? item.defaultUnit,
                          },
                        }))
                      }
                      inputMode="decimal"
                      aria-label={`Standardantal för ${item.name}`}
                    />
                    <select
                      value={catalogDefaultDrafts[item.id]?.unit ?? item.defaultUnit}
                      onChange={(event) =>
                        setCatalogDefaultDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            quantity: prev[item.id]?.quantity ?? String(item.defaultQuantity),
                            unit: event.target.value as Unit,
                          },
                        }))
                      }
                      aria-label={`Enhet för ${item.name}`}
                    >
                      {item.units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <select
                      value={personalCategory}
                      onChange={(event) => updateCategoryOverride(item.id, event.target.value)}
                      aria-label={`Min kategori för ${item.name}`}
                    >
                      {DEFAULT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => saveCatalogDefaults(item.id)}>Spara</button>
                    <button className="ghost danger" onClick={() => removeCatalogItem(item.id)}>
                      Ta bort
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="content-grid">
          <article className="panel">
            <h2>Notiser</h2>
            <p>Daglig sammanställning (08:00, Europe/Stockholm):</p>
            <div className="row-actions">
              <button onClick={toggleDailySummary}>
                {activeSetting?.dailySummaryEnabled ?? true ? "På" : "Av"}
              </button>
              <button className="ghost" onClick={() => runDailySummary(true)}>
                Testa nu
              </button>
            </div>
          </article>

          <article className="panel">
            <h2>Hushåll</h2>
            <button onClick={createInvite}>Skapa inbjudningslänk (7 dagar)</button>
            <ul className="list compact">
              {activeHousehold?.invites.slice(0, 6).map((invite) => (
                <li key={invite.token}>
                  <span>
                    {invite.usedBy ? "Använd" : "Aktiv"} - giltig till {formatDateTime(invite.expiresAt)}
                  </span>
                </li>
              ))}
            </ul>

            <h3>Medlemmar</h3>
            <div className="members">
              {householdMembers.map((member) => (
                <span key={member.id}>{member.firstName}</span>
              ))}
            </div>
            <button className="ghost danger" onClick={deleteActiveHousehold}>
              Radera hushåll
            </button>
          </article>

          <article className="panel full">
            <h2>Boenden</h2>
            <p className="small">Exempel: Sommarstuga, Lägenhet i stan.</p>
            <ul className="list compact">
              {activeDwellings.map((dwelling) => (
                <li key={dwelling.id} className="dwelling-list-row">
                  {editingDwellingId === dwelling.id ? (
                    <div className="dwelling-editor">
                      <label>
                        Namn
                        <input
                          value={editingDwellingName}
                          onChange={(event) => setEditingDwellingName(event.target.value)}
                        />
                      </label>
                      <label>
                        Ikon
                        <input
                          value={editingDwellingIcon}
                          onChange={(event) => setEditingDwellingIcon(event.target.value)}
                          placeholder="Ex: 🏡"
                        />
                      </label>
                      <label>
                        Accentfärg
                        <input
                          type="color"
                          value={editingDwellingAccent}
                          onChange={(event) => setEditingDwellingAccent(event.target.value)}
                        />
                      </label>
                      <div className="icon-suggestions">
                        {DWELLING_ICON_SUGGESTIONS.map((icon) => (
                          <button
                            key={`${dwelling.id}-${icon}`}
                            type="button"
                            className={`icon-pick ${editingDwellingIcon === icon ? "active" : ""}`}
                            onClick={() => setEditingDwellingIcon(icon)}
                            aria-label={`Välj ikon ${icon}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                      <div className="row-actions">
                        <button type="button" onClick={saveDwellingEdit}>
                          Spara
                        </button>
                        <button type="button" className="ghost" onClick={cancelDwellingEdit}>
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>
                        {dwelling.icon} {dwelling.name}
                      </span>
                      <div className="row-actions dwelling-actions">
                        <button onClick={() => switchDwelling(dwelling.id)}>Välj</button>
                        <button className="ghost" onClick={() => startEditDwelling(dwelling)}>
                          Redigera
                        </button>
                        <button className="ghost danger" onClick={() => deleteDwelling(dwelling.id)}>
                          Radera
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <form className="todo-form" onSubmit={addDwelling}>
              <label>
                Namn
                <input
                  value={newDwellingName}
                  onChange={(event) => setNewDwellingName(event.target.value)}
                  placeholder="Ex: Sommarstuga"
                  required
                />
              </label>
              <label>
                Ikon
                <input
                  value={newDwellingIcon}
                  onChange={(event) => setNewDwellingIcon(event.target.value)}
                  placeholder="Ex: 🏡"
                  required
                />
              </label>
              <label>
                Accentfärg
                <input type="color" value={newDwellingAccent} onChange={(event) => setNewDwellingAccent(event.target.value)} />
              </label>
              <button type="submit">Lägg till boende</button>
            </form>
            <div className="icon-suggestions">
              {DWELLING_ICON_SUGGESTIONS.map((icon) => (
                <button
                  key={`new-${icon}`}
                  type="button"
                  className={`icon-pick ${newDwellingIcon === icon ? "active" : ""}`}
                  onClick={() => setNewDwellingIcon(icon)}
                  aria-label={`Välj ikon ${icon}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <h2>Varubibliotek</h2>
            <p className="small">Öppna varubiblioteket för att redigera upplagda varor. Biblioteket delas i alla hushåll du är med i.</p>
            <button onClick={() => setTab("catalog")}>Öppna varubibliotek</button>
          </article>

          <article className="panel">
            <h2>Konto</h2>
            <p>
              {currentUser?.firstName ?? "Användare"} {currentUser?.lastName ?? ""}
            </p>
            <p className="small">{currentUser?.email ?? "Ingen e-post"}</p>
          </article>

          {inviteFromUrl ? (
            <article className="panel full">
              <h2>Inbjudan i länken</h2>
              <p>Tryck för att ansluta med token från URL.</p>
              <button onClick={() => joinByToken(inviteFromUrl)}>Anslut hushåll</button>
            </article>
          ) : null}
        </section>
      ) : null}

      {showCategoryModal ? (
        <div className="modal-backdrop">
          <article className="modal-card">
            <h2>Ordna kategorier</h2>
            <ul className="list compact">
              {categoryDraft.map((category, index) => (
                <li key={`${category}-${index}`}>
                  <span>{category}</span>
                  <div className="row-actions">
                    <button onClick={() => reorderCategoryDraft(category, -1)}>Upp</button>
                    <button onClick={() => reorderCategoryDraft(category, 1)}>Ner</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button className="ghost" onClick={() => setShowCategoryModal(false)}>
                Avbryt
              </button>
              <button onClick={saveCategoryOrder}>Spara</button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingNewList ? (
        <div className="modal-backdrop">
          <article className="modal-card">
            <h2>Ny lista</h2>
            <p>Ingen inköpslista är vald. Skapa en ny lista för att fortsätta.</p>
            <label>
              Listnamn
              <input
                value={pendingNewList.name}
                onChange={(event) =>
                  setPendingNewList((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>
            <div className="row-actions">
              <button className="ghost" onClick={() => setPendingNewList(null)}>
                Avbryt
              </button>
              <button
                onClick={() => {
                  if (!pendingNewList.name.trim()) {
                    pushToast("Alla inköpslistor måste ha ett namn.");
                    return;
                  }
                  const createdListId = createShoppingList(pendingNewList.name);
                  const pendingInput = pendingNewList.pendingInput;
                  setPendingNewList(null);
                  if (createdListId && pendingInput?.trim()) {
                    addShoppingFromInput(pendingInput, createdListId);
                  }
                }}
              >
                Skapa lista
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {showRecipeImagePicker ? (
        <div className="modal-backdrop">
          <article className="modal-card">
            <h2>Omslagsbild</h2>
            <p>Välj hur du vill lägga till bilden.</p>
            <div className="row-actions">
              <button
                onClick={() => {
                  setShowRecipeImagePicker(false);
                  recipeCameraInputRef.current?.click();
                }}
              >
                Använd kamera
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setShowRecipeImagePicker(false);
                  recipeAlbumInputRef.current?.click();
                }}
              >
                Välj från album
              </button>
              <button className="ghost" onClick={() => setShowRecipeImagePicker(false)}>
                Avbryt
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingRecipeIngredient ? (
        <div className="modal-backdrop">
          <article className="modal-card">
            <h2>Ingrediens saknas</h2>
            <p>Ingen träff i varubiblioteket. Kontrollera och spara ingrediensen.</p>
            <label>
              Namn
              <input
                value={pendingRecipeIngredient.name}
                onChange={(event) =>
                  setPendingRecipeIngredient((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Standardantal
              <input
                value={String(pendingRecipeIngredient.quantity)}
                onChange={(event) =>
                  setPendingRecipeIngredient((prev) =>
                    prev
                      ? {
                          ...prev,
                          quantity: Number(event.target.value.replace(",", ".")) || 1,
                        }
                      : prev,
                  )
                }
                inputMode="decimal"
              />
            </label>
            <label>
              Enhet
              <select
                value={pendingRecipeIngredient.unit}
                onChange={(event) =>
                  setPendingRecipeIngredient((prev) => (prev ? { ...prev, unit: event.target.value as Unit } : prev))
                }
              >
                {(["st", "pkt", "kg", "g", "l", "dl", "ml", "burk"] as Unit[]).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kategori
              <select
                value={pendingRecipeIngredient.category}
                onChange={(event) =>
                  setPendingRecipeIngredient((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                }
              >
                {DEFAULT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions">
              <button className="ghost" onClick={() => setPendingRecipeIngredient(null)}>
                Avbryt
              </button>
              <button onClick={confirmCreateRecipeIngredient}>Spara ingrediens</button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingNewProduct ? (
        <div className="modal-backdrop">
          <article className="modal-card">
            <h2>Ingen träff hittades</h2>
            <p>Vill du lägga till den här varan? Kontrollera uppgifterna först.</p>
            <label>
              Namn
              <input
                value={pendingNewProduct.name}
                onChange={(event) =>
                  setPendingNewProduct((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Standardantal
              <input
                value={String(pendingNewProduct.quantity)}
                onChange={(event) =>
                  setPendingNewProduct((prev) =>
                    prev
                      ? {
                          ...prev,
                          quantity: Number(event.target.value.replace(",", ".")) || 1,
                        }
                      : prev,
                  )
                }
                inputMode="decimal"
              />
            </label>
            <label>
              Enhet
              <select
                value={pendingNewProduct.unit}
                onChange={(event) =>
                  setPendingNewProduct((prev) => (prev ? { ...prev, unit: event.target.value as Unit } : prev))
                }
              >
                {(["st", "pkt", "kg", "g", "l", "dl", "ml", "burk"] as Unit[]).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kategori
              <select
                value={pendingNewProduct.category}
                onChange={(event) =>
                  setPendingNewProduct((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                }
              >
                {DEFAULT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions">
              <button className="ghost" onClick={() => setPendingNewProduct(null)}>
                Avbryt
              </button>
              <button onClick={confirmCreateMissingProduct}>Verifiera och lägg till</button>
            </div>
          </article>
        </div>
      ) : null}

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
      />
    </main>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <aside className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <p>{toast.message}</p>
          <div className="row-actions">
            {toast.actionLabel && toast.action ? (
              <button
                onClick={() => {
                  toast.action?.();
                  onDismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button className="ghost" onClick={() => onDismiss(toast.id)}>
              Stäng
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
}
