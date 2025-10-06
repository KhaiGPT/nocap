import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createClient } from '@supabase/supabase-js';

// Debug: Check available environment variables (dev only)
if (process.env.NODE_ENV !== 'production') {
  console.log('Available environment variables:', {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'
  });
}

// Try to get Supabase URL from environment or fallback
let supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  // Try without VITE_ prefix in case it's set differently on server
  supabaseUrl = process.env.SUPABASE_URL;
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create admin Supabase client only if we have the required credentials
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && serviceRoleKey) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Creating Supabase admin client with service role key');
  }
  supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
} else {
  console.error('Missing required Supabase credentials:');
  console.error('- supabaseUrl:', supabaseUrl ? 'Set' : 'Missing');
  console.error('- serviceRoleKey:', serviceRoleKey ? 'Set' : 'Missing');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Setup database tables endpoint
  app.post('/api/setup-database', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin client not available' });
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Setting up database tables...');
      }

      // Try to create tables using direct table insertion to test if they exist
      try {
        // Test if categories table exists by trying to read from it
        const { data, error } = await supabaseAdmin.from('categories').select('id').limit(1);
        if (error && error.code === '42P01') {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Categories table does not exist - will be created via Supabase UI');
          }
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Categories table already exists');
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Categories table check failed:', err);
        }
      }

      res.json({ 
        success: true, 
        message: 'Database table check completed. Please ensure tables are created in Supabase dashboard.',
        instructions: 'Go to Supabase Dashboard → SQL Editor and run the table creation scripts if tables do not exist.'
      });
    } catch (error) {
      console.error('Error setting up database:', error);
      res.status(500).json({ error: 'Failed to setup database tables' });
    }
  });

  // Delete user account endpoint
  app.delete('/api/user', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      if (!supabaseAdmin) {
        console.error('Server: Supabase admin client not available');
        return res.status(500).json({ 
          error: 'Server configuration error: Missing Supabase credentials',
          details: 'Supabase service role key or URL not configured'
        });
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Server: User deletion requested for:', userId);
      }
      
      // Delete user data from database tables first
      if (process.env.NODE_ENV !== 'production') {
        console.log('Server: Deleting user expenses...');
      }
      const { error: expensesError } = await supabaseAdmin
        .from('expenses')
        .delete()
        .eq('user_id', userId);

      if (expensesError) {
        console.error('Server: Error deleting expenses:', expensesError);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Server: Deleting user budgets...');
      }
      const { error: budgetsError } = await supabaseAdmin
        .from('budgets')
        .delete()
        .eq('user_id', userId);

      if (budgetsError) {
        console.error('Server: Error deleting budgets:', budgetsError);
      }

      // Delete the user from Supabase Auth using admin privileges
      if (process.env.NODE_ENV !== 'production') {
        console.log('Server: Deleting user from Supabase Auth...');
      }
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteUserError) {
        console.error('Server: Error deleting auth user:', deleteUserError);
        return res.status(500).json({ error: 'Failed to delete user account', details: deleteUserError.message });
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Server: User account and all data deleted successfully');
      }
      res.json({ success: true, message: 'User account and all data deleted successfully' });
      
    } catch (error) {
      console.error('Server: Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
