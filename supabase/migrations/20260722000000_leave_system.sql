-- Create Leave Requests Table
CREATE TABLE IF NOT EXISTS advanced_leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    leave_date TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE advanced_leave_requests ENABLE ROW LEVEL SECURITY;

-- Policies for advanced_leave_requests
CREATE POLICY "Select advanced_leave_requests" ON advanced_leave_requests FOR SELECT USING (band_id = get_my_band_id());
CREATE POLICY "Insert advanced_leave_requests" ON advanced_leave_requests FOR INSERT WITH CHECK (band_id = get_my_band_id() AND user_id = auth.uid());
CREATE POLICY "Update advanced_leave_requests" ON advanced_leave_requests FOR UPDATE USING (band_id = get_my_band_id() AND (user_id = auth.uid() OR get_my_role() = ANY(ARRAY['manager', 'admin'])));
CREATE POLICY "Delete advanced_leave_requests" ON advanced_leave_requests FOR DELETE USING (band_id = get_my_band_id() AND (user_id = auth.uid() OR get_my_role() = ANY(ARRAY['manager', 'admin'])));

-- Create Leave Substitutes Table (for tracking who subs which break)
CREATE TABLE IF NOT EXISTS advanced_leave_substitutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_request_id UUID NOT NULL REFERENCES advanced_leave_requests(id) ON DELETE CASCADE,
    break_number INTEGER, -- NULL means all breaks / full day
    substitute_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    substitute_name TEXT, -- Fallback for external/non-user substitute
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE advanced_leave_substitutes ENABLE ROW LEVEL SECURITY;

-- Policies for advanced_leave_substitutes
CREATE POLICY "Select advanced_leave_substitutes" ON advanced_leave_substitutes FOR SELECT USING (
  EXISTS (SELECT 1 FROM advanced_leave_requests lr WHERE lr.id = advanced_leave_substitutes.leave_request_id AND lr.band_id = get_my_band_id())
);
CREATE POLICY "Insert advanced_leave_substitutes" ON advanced_leave_substitutes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM advanced_leave_requests lr WHERE lr.id = advanced_leave_substitutes.leave_request_id AND lr.band_id = get_my_band_id() AND (lr.user_id = auth.uid() OR get_my_role() = ANY(ARRAY['manager', 'admin'])))
);
CREATE POLICY "Update advanced_leave_substitutes" ON advanced_leave_substitutes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM advanced_leave_requests lr WHERE lr.id = advanced_leave_substitutes.leave_request_id AND lr.band_id = get_my_band_id() AND (lr.user_id = auth.uid() OR get_my_role() = ANY(ARRAY['manager', 'admin'])))
);
CREATE POLICY "Delete advanced_leave_substitutes" ON advanced_leave_substitutes FOR DELETE USING (
  EXISTS (SELECT 1 FROM advanced_leave_requests lr WHERE lr.id = advanced_leave_substitutes.leave_request_id AND lr.band_id = get_my_band_id() AND (lr.user_id = auth.uid() OR get_my_role() = ANY(ARRAY['manager', 'admin'])))
);
