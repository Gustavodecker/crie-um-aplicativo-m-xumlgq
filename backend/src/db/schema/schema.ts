import { pgTable, text, uuid, timestamp, integer, date, uniqueIndex, index, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth-schema.js';

// Consultants table
export const consultants = pgTable('consultants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  photo: text('photo'),
  logo: text('logo'),
  professionalTitle: text('professional_title'),
  description: text('description'),
  primaryColor: text('primary_color').default('#6B4CE6'),
  secondaryColor: text('secondary_color').default('#9D7FEA'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Babies table
export const babies = pgTable('babies', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').unique(),
  name: text('name').notNull(),
  birthDate: date('birth_date').notNull(),
  motherName: text('mother_name').notNull(),
  motherPhone: text('mother_phone').notNull(),
  motherEmail: text('mother_email').notNull(),
  motherUserId: text('mother_user_id').references(() => user.id, { onDelete: 'set null' }),
  consultantId: uuid('consultant_id').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  objectives: text('objectives'),
  conclusion: text('conclusion'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('babies_consultant_id_idx').on(table.consultantId),
  index('babies_mother_user_id_idx').on(table.motherUserId),
  index('babies_token_idx').on(table.token),
]);

// Contracts table
export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  babyId: uuid('baby_id').notNull().references(() => babies.id, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  durationDays: integer('duration_days').notNull(),
  status: text('status').notNull(), // 'active', 'paused', 'completed'
  contractPdfUrl: text('contract_pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('contracts_baby_id_idx').on(table.babyId),
]);

// Daily routines table
export const dailyRoutines = pgTable('daily_routines', {
  id: uuid('id').primaryKey().defaultRandom(),
  babyId: uuid('baby_id').notNull().references(() => babies.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  wakeUpTime: text('wake_up_time').notNull(), // HH:mm format
  motherObservations: text('mother_observations'),
  consultantComments: text('consultant_comments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex('daily_routines_baby_date_idx').on(table.babyId, table.date),
  index('daily_routines_baby_id_idx').on(table.babyId),
]);

// Naps table
export const naps = pgTable('naps', {
  id: uuid('id').primaryKey().defaultRandom(),
  routineId: uuid('routine_id').notNull().references(() => dailyRoutines.id, { onDelete: 'cascade' }),
  napNumber: integer('nap_number').notNull(), // 1 to 6
  startTryTime: text('start_try_time').notNull(), // HH:mm
  fellAsleepTime: text('fell_asleep_time'), // HH:mm
  wakeUpTime: text('wake_up_time'), // HH:mm
  sleepMethod: text('sleep_method'), // 'colo', 'embalo', 'mamando', 'sozinho_berco'
  environment: text('environment'), // 'adequado', 'parcialmente_adequado', 'inadequado'
  wakeUpMood: text('wake_up_mood'), // 'bom_humor', 'sorrindo', 'choroso', 'muito_irritado'
  observations: text('observations'),
  consultantComments: text('consultant_comments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('naps_routine_id_idx').on(table.routineId),
]);

// Night sleep table
export const nightSleep = pgTable('night_sleep', {
  id: uuid('id').primaryKey().defaultRandom(),
  routineId: uuid('routine_id').notNull().unique().references(() => dailyRoutines.id, { onDelete: 'cascade' }),
  startTryTime: text('start_try_time'), // HH:mm
  fellAsleepTime: text('fell_asleep_time'), // HH:mm
  finalWakeTime: text('final_wake_time'), // HH:mm
  sleepMethod: text('sleep_method'),
  environment: text('environment'),
  wakeUpMood: text('wake_up_mood'),
  observations: text('observations'),
  consultantComments: text('consultant_comments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('night_sleep_routine_id_idx').on(table.routineId),
]);

// Night wakings table
export const nightWakings = pgTable('night_wakings', {
  id: uuid('id').primaryKey().defaultRandom(),
  nightSleepId: uuid('night_sleep_id').notNull().references(() => nightSleep.id, { onDelete: 'cascade' }),
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('night_wakings_night_sleep_id_idx').on(table.nightSleepId),
]);

// Orientations table
export const orientations = pgTable('orientations', {
  id: uuid('id').primaryKey().defaultRandom(),
  babyId: uuid('baby_id').notNull().references(() => babies.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  orientationText: text('orientation_text').notNull(),
  results: text('results'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('orientations_baby_id_idx').on(table.babyId),
]);

// Sleep windows config table
export const sleepWindowsConfig = pgTable('sleep_windows_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  consultantId: uuid('consultant_id').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  ageMonthsMin: integer('age_months_min').notNull(),
  ageMonthsMax: integer('age_months_max').notNull(),
  windowMinutes: integer('window_minutes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sleep_windows_config_consultant_id_idx').on(table.consultantId),
]);

// Relations
export const consultantsRelations = relations(consultants, ({ many }) => ({
  babies: many(babies),
  contracts: many(contracts),
  sleepWindowsConfigs: many(sleepWindowsConfig),
}));

export const babiesRelations = relations(babies, ({ one, many }) => ({
  consultant: one(consultants, { fields: [babies.consultantId], references: [consultants.id] }),
  contracts: many(contracts),
  dailyRoutines: many(dailyRoutines),
  orientations: many(orientations),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  baby: one(babies, { fields: [contracts.babyId], references: [babies.id] }),
}));

export const dailyRoutinesRelations = relations(dailyRoutines, ({ one, many }) => ({
  baby: one(babies, { fields: [dailyRoutines.babyId], references: [babies.id] }),
  naps: many(naps),
  nightSleep: many(nightSleep),
}));

export const napsRelations = relations(naps, ({ one }) => ({
  routine: one(dailyRoutines, { fields: [naps.routineId], references: [dailyRoutines.id] }),
}));

export const nightSleepRelations = relations(nightSleep, ({ one, many }) => ({
  routine: one(dailyRoutines, { fields: [nightSleep.routineId], references: [dailyRoutines.id] }),
  wakings: many(nightWakings),
}));

export const nightWakingsRelations = relations(nightWakings, ({ one }) => ({
  nightSleep: one(nightSleep, { fields: [nightWakings.nightSleepId], references: [nightSleep.id] }),
}));

export const orientationsRelations = relations(orientations, ({ one }) => ({
  baby: one(babies, { fields: [orientations.babyId], references: [babies.id] }),
}));

export const sleepWindowsConfigRelations = relations(sleepWindowsConfig, ({ one }) => ({
  consultant: one(consultants, { fields: [sleepWindowsConfig.consultantId], references: [consultants.id] }),
}));
