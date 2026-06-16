# SoulLink Tracker — Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com and create a free account
2. Create a new project (choose any region)
3. Wait for the project to provision (~1 min)

## 2. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy & paste the entire contents of `supabase/schema.sql`
4. Click **Run**

## 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. In Supabase: go to **Settings → API**
3. Copy your **Project URL** → paste as `VITE_SUPABASE_URL`
4. Copy the **anon / public** key → paste as `VITE_SUPABASE_ANON_KEY`

## 4. Run the App

```bash
npm install
npm run dev
```

Open http://localhost:5173

## How SoulLink Works

- **Create a Run**: One player creates the run and sets both player names
- **Share Code**: Copy the 8-character code and send it to your partner
- **Join**: Your partner enters the share code + their name to join
- **Add Encounters**: Both players log their caught Pokémon per location
- **Link Pokémon**: Connect one Pokémon from each player (same route = soul link)
- **"Both Die"**: If one linked Pokémon faints, click "Both die" to mark both as dead
- **Realtime sync**: Changes appear instantly for both players via Supabase Realtime

## Features

- Real-time updates (both players see changes instantly)
- PokéAPI integration (sprites, types, search)
- Status tracking: Alive / Dead / Boxed / Missing
- Soul Link pair view with quick "kill both" action
- Grid/List view per player
- Share code to invite partner
- Persistent state (survives page refreshes)
