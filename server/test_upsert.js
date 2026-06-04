const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function testFullUpsert() {
  const d = {
    belt_number: 'A/1', pay_code: 'TEST001', full_name: 'TEST PERSON', father_name: 'FATHER',
    photo_url: null, date_of_birth: '1984-05-12', gender: 'MALE', blood_group: null,
    mobile_number: '9876543210', alternate_contact: null, religion: 'HINDU', caste: 'GEN',
    category: null, aadhar_number: null, pan: null, village: 'TEST VILLAGE',
    police_station: 'PS TEST', home_district: 'TEST DISTRICT', home_district_ps: null,
    rank: 'CONST', cadre: null, service_type: 'PERMANENT', service_status: 'Active',
    service_book_number: null, date_of_enlistment: '2008-05-26', date_of_last_promotion: null,
    retirement_date: null, ps_duty_type: null, io_status: null, io_category: null,
    parade_group: null, spo_trade: null, company: null, r_batch: null, t_duty_order: null,
    remarks: null, graduation_degree: '10th / Matric', subject_graduation: null,
    pg_degree: null, subject_post_graduation: null, node_id: '55f17833-4cfc-4214-b208-2266af991a34',
    date_of_posting: null, extra_fields: {}, uid: null
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO personnel (
         belt_number, pay_code, full_name, father_name, photo_url,
         date_of_birth, gender, blood_group, mobile_number, alternate_contact,
         religion, caste, category, aadhar_number, pan,
         village, police_station, home_district, home_district_ps,
         rank, cadre, service_type, service_status, service_book_number,
         date_of_enlistment, date_of_last_promotion, retirement_date,
         ps_duty_type, io_status, io_category, parade_group, spo_trade,
         company, r_batch, t_duty_order, remarks,
         graduation_degree, subject_graduation, pg_degree, subject_post_graduation,
         node_id, date_of_posting,
         extra_fields, created_by_user_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,$33,$34,$35,$36,
         $37,$38,$39,$40,$41,$42,$43,$44
       )
       ON CONFLICT (pay_code) WHERE pay_code IS NOT NULL AND pay_code != '' AND is_deleted = false
       DO UPDATE SET
         belt_number            = EXCLUDED.belt_number,
         full_name              = EXCLUDED.full_name,
         father_name            = EXCLUDED.father_name,
         date_of_birth          = EXCLUDED.date_of_birth,
         gender                 = EXCLUDED.gender,
         blood_group            = COALESCE(EXCLUDED.blood_group, personnel.blood_group),
         mobile_number          = EXCLUDED.mobile_number,
         alternate_contact      = COALESCE(EXCLUDED.alternate_contact, personnel.alternate_contact),
         religion               = EXCLUDED.religion,
         caste                  = EXCLUDED.caste,
         category               = EXCLUDED.category,
         aadhar_number          = COALESCE(EXCLUDED.aadhar_number, personnel.aadhar_number),
         pan                    = COALESCE(EXCLUDED.pan, personnel.pan),
         village                = EXCLUDED.village,
         police_station         = EXCLUDED.police_station,
         home_district          = EXCLUDED.home_district,
         rank                   = EXCLUDED.rank,
         cadre                  = EXCLUDED.cadre,
         service_type           = EXCLUDED.service_type,
         service_status         = EXCLUDED.service_status,
         service_book_number    = COALESCE(EXCLUDED.service_book_number, personnel.service_book_number),
         date_of_enlistment     = EXCLUDED.date_of_enlistment,
         date_of_last_promotion = EXCLUDED.date_of_last_promotion,
         retirement_date        = COALESCE(EXCLUDED.retirement_date, personnel.retirement_date),
         graduation_degree      = EXCLUDED.graduation_degree,
         subject_graduation     = EXCLUDED.subject_graduation,
         pg_degree              = EXCLUDED.pg_degree,
         subject_post_graduation= EXCLUDED.subject_post_graduation,
         node_id                = EXCLUDED.node_id,
         updated_at             = NOW(),
         updated_by_user_id     = $44
       RETURNING id, full_name, pay_code, (xmax = 0) AS is_new_record`,
      [
        d.belt_number, d.pay_code, d.full_name, d.father_name, d.photo_url,
        d.date_of_birth, d.gender, d.blood_group, d.mobile_number, d.alternate_contact,
        d.religion, d.caste, d.category, d.aadhar_number, d.pan,
        d.village, d.police_station, d.home_district, d.home_district_ps,
        d.rank, d.cadre, d.service_type, d.service_status, d.service_book_number,
        d.date_of_enlistment, d.date_of_last_promotion, d.retirement_date,
        d.ps_duty_type, d.io_status, d.io_category, d.parade_group, d.spo_trade,
        d.company, d.r_batch, d.t_duty_order, d.remarks,
        d.graduation_degree, d.subject_graduation, d.pg_degree, d.subject_post_graduation,
        d.node_id, d.date_of_posting,
        JSON.stringify(d.extra_fields), d.uid
      ]
    );
    console.log('✅ Full upsert INSERT works:', rows[0]);

    // Run again to test UPDATE path
    const r2 = await pool.query(
      `INSERT INTO personnel (
         belt_number, pay_code, full_name, father_name, photo_url,
         date_of_birth, gender, blood_group, mobile_number, alternate_contact,
         religion, caste, category, aadhar_number, pan,
         village, police_station, home_district, home_district_ps,
         rank, cadre, service_type, service_status, service_book_number,
         date_of_enlistment, date_of_last_promotion, retirement_date,
         ps_duty_type, io_status, io_category, parade_group, spo_trade,
         company, r_batch, t_duty_order, remarks,
         graduation_degree, subject_graduation, pg_degree, subject_post_graduation,
         node_id, date_of_posting,
         extra_fields, created_by_user_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,$33,$34,$35,$36,
         $37,$38,$39,$40,$41,$42,$43,$44
       )
       ON CONFLICT (pay_code) WHERE pay_code IS NOT NULL AND pay_code != '' AND is_deleted = false
       DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW(), updated_by_user_id = $44
       RETURNING id, full_name, pay_code, (xmax = 0) AS is_new_record`,
      [
        d.belt_number, d.pay_code, 'UPDATED NAME', d.father_name, d.photo_url,
        d.date_of_birth, d.gender, d.blood_group, d.mobile_number, d.alternate_contact,
        d.religion, d.caste, d.category, d.aadhar_number, d.pan,
        d.village, d.police_station, d.home_district, d.home_district_ps,
        d.rank, d.cadre, d.service_type, d.service_status, d.service_book_number,
        d.date_of_enlistment, d.date_of_last_promotion, d.retirement_date,
        d.ps_duty_type, d.io_status, d.io_category, d.parade_group, d.spo_trade,
        d.company, d.r_batch, d.t_duty_order, d.remarks,
        d.graduation_degree, d.subject_graduation, d.pg_degree, d.subject_post_graduation,
        d.node_id, d.date_of_posting,
        JSON.stringify(d.extra_fields), d.uid
      ]
    );
    console.log('✅ Full upsert UPDATE works:', r2.rows[0]);

    // cleanup
    await pool.query(`DELETE FROM personnel WHERE pay_code = 'TEST001'`);
    console.log('✅ Cleaned up');
  } catch(err) {
    console.error('❌ Error:', err.message);
    console.error('   Detail:', err.detail);
    console.error('   Hint:', err.hint);
    console.error('   Code:', err.code);
  }
  await pool.end();
}
testFullUpsert();
