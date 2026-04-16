import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

@Injectable()
export class AdminPeopleService {
  private readonly logger = new Logger(AdminPeopleService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string, role?: string) {
    let query = this.supabaseService.client
      .from('people')
      .select('*')
      .order('name', { ascending: true });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch people: ${error.message}`);

    // Add content count for each person
    const people = data || [];
    for (const person of people) {
      const { count } = await this.supabaseService.client
        .from('content_people')
        .select('*', { count: 'exact', head: true })
        .eq('person_id', person.id);
      person.content_count = count || 0;
    }

    return people;
  }

  async findById(id: string) {
    const { data, error } = await this.supabaseService.client
      .from('people')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Person not found`);
    return data;
  }

  async findByIdWithContent(id: string) {
    const person = await this.findById(id);

    // Get all content linked to this person
    const { data: links } = await this.supabaseService.client
      .from('content_people')
      .select('content_id, role, character_name, display_order')
      .eq('person_id', id)
      .order('display_order', { ascending: true });

    if (!links || links.length === 0) {
      return { ...person, contents: [] };
    }

    const contentIds = links.map(l => l.content_id);
    const { data: contents } = await this.supabaseService.client
      .from('content')
      .select('*')
      .in('id', contentIds)
      .eq('status', 'PUBLISHED');

    return { ...person, contents: contents || [] };
  }

  async create(data: { name: string; role?: string; photo_url?: string; bio?: string }) {
    const { data: person, error } = await this.supabaseService.client
      .from('people')
      .insert({
        name: data.name.trim(),
        role: data.role || 'actor',
        photo_url: data.photo_url || null,
        bio: data.bio || null,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation — person already exists
      if (error.code === '23505') {
        const { data: existing } = await this.supabaseService.client
          .from('people')
          .select('*')
          .ilike('name', data.name.trim())
          .eq('role', data.role || 'actor')
          .single();
        return existing;
      }
      throw new Error(`Failed to create person: ${error.message}`);
    }
    return person;
  }

  async findOrCreate(name: string, role: string = 'actor') {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // Try to find existing
    const { data: existing } = await this.supabaseService.client
      .from('people')
      .select('*')
      .ilike('name', trimmed)
      .eq('role', role)
      .limit(1)
      .single();

    if (existing) return existing;

    // Create new
    return this.create({ name: trimmed, role });
  }

  async update(id: string, data: { name?: string; photo_url?: string; bio?: string; role?: string }) {
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.photo_url !== undefined) updatePayload.photo_url = data.photo_url;
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.role !== undefined) updatePayload.role = data.role;

    const { data: person, error } = await this.supabaseService.client
      .from('people')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update person: ${error.message}`);
    return person;
  }

  async delete(id: string) {
    const { error } = await this.supabaseService.client
      .from('people')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete person: ${error.message}`);
    return { success: true };
  }

  /**
   * Sync content_people for a given content.
   * Receives arrays of actor names and director name, creates people if needed,
   * and replaces all content_people rows for this content.
   */
  async syncContentPeople(contentId: string, actors: string[], director?: string) {
    // Delete existing links
    await this.supabaseService.client
      .from('content_people')
      .delete()
      .eq('content_id', contentId);

    const inserts: any[] = [];

    // Process actors
    for (let i = 0; i < actors.length; i++) {
      const name = actors[i]?.trim();
      if (!name) continue;
      const person = await this.findOrCreate(name, 'actor');
      if (person) {
        inserts.push({
          content_id: contentId,
          person_id: person.id,
          role: 'actor',
          display_order: i,
        });
      }
    }

    // Process director
    if (director?.trim()) {
      const person = await this.findOrCreate(director.trim(), 'director');
      if (person) {
        inserts.push({
          content_id: contentId,
          person_id: person.id,
          role: 'director',
          display_order: 0,
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await this.supabaseService.client
        .from('content_people')
        .insert(inserts);
      if (error) {
        this.logger.error(`Failed to sync content_people: ${error.message}`);
      }
    }
  }
}
