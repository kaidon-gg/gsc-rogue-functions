# GSC Rogue Functions

A collection of Supabase Edge Functions for handling event registration emails and user notifications.

## Overview

This project contains serverless functions built for Supabase that handle:

- **Event Registration Emails**: Automatically send confirmation emails when users register for league events
- **User Event Data Management**: Fetch and process user and event information from the database

## Functions

### send-event-registration-email

Triggered when a user registers for a league event. Automatically sends a personalized confirmation email using Resend API.

**Trigger**: Database webhook on `league_event_players` table  
**Dependencies**: Resend API for email delivery

## Environment Variables

The following environment variables need to be configured in your Supabase project:

- `RESEND_API_KEY` - API key for Resend email service
- `FROM_EMAIL` - Sender email address (e.g., "Rogue League <hello@your-domain>")
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `EDGE_WEBHOOK_SECRET` - Secret for webhook verification
