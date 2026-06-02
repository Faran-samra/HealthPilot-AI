-- Extended doctor profile (Marham-style) + guest appointments

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE appointments
  ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

CREATE OR REPLACE FUNCTION create_guest_appointment(
  p_doctor_id UUID,
  p_guest_name TEXT,
  p_guest_phone TEXT,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_patient_notes TEXT DEFAULT NULL,
  p_consultation_fee INTEGER DEFAULT NULL
)
RETURNS appointments AS $$
DECLARE
  result appointments;
BEGIN
  IF p_guest_name IS NULL OR trim(p_guest_name) = '' THEN
    RAISE EXCEPTION 'guest_name required';
  END IF;
  IF p_guest_phone IS NULL OR trim(p_guest_phone) = '' THEN
    RAISE EXCEPTION 'guest_phone required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_appointment_date
      AND appointment_time = p_appointment_time
      AND status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;

  INSERT INTO appointments (
    patient_id,
    doctor_id,
    guest_name,
    guest_phone,
    appointment_date,
    appointment_time,
    patient_notes,
    consultation_fee,
    booking_method,
    status
  ) VALUES (
    NULL,
    p_doctor_id,
    trim(p_guest_name),
    trim(p_guest_phone),
    p_appointment_date,
    p_appointment_time,
    p_patient_notes,
    p_consultation_fee,
    'in_app',
    'pending'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_guest_appointment TO anon, authenticated;
