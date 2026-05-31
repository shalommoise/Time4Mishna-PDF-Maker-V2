# Database Schema

This project reads from the existing `time4torah_db` database. It does not create, migrate, or modify tables.

Use a read-only MySQL user for this tool where possible.

```sql
dates_table (
    date_id INT NOT NULL AUTO_INCREMENT,
    gregorian_date VARCHAR(12) NOT NULL,
    hebrew_date VARCHAR(30),
    hebrew_date_he VARCHAR(30),
    day_of_week VARCHAR(12),
    is_yom_tov BOOLEAN,
    special_date VARCHAR(150),
    PRIMARY KEY (date_id)
);

sedarim_table (
    seder_id INT NOT NULL AUTO_INCREMENT,
    seder_name VARCHAR(15) NOT NULL UNIQUE,
    alt_names VARCHAR(50),
    PRIMARY KEY (seder_id)
);

masechta_table (
    masechta_id INT NOT NULL AUTO_INCREMENT,
    masechta_name VARCHAR(20) NOT NULL UNIQUE,
    alt_names VARCHAR(100),
    number_of_perakim INT NOT NULL,
    number_of_mishnayos INT NOT NULL,
    seder_id INT,
    PRIMARY KEY (masechta_id),
    FOREIGN KEY (seder_id) REFERENCES sedarim_table(seder_id)
);

mishnayos_table (
    mishna_id INT NOT NULL AUTO_INCREMENT,
    masechta_id INT,
    perek INT NOT NULL,
    mishna INT NOT NULL,
    mishna_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    PRIMARY KEY (mishna_id),
    FOREIGN KEY (masechta_id) REFERENCES masechta_table(masechta_id)
);

time4mishna_shiurim (
    time4mishna_shiur_id INT NOT NULL AUTO_INCREMENT,
    shiur_title VARCHAR(40) UNIQUE,
    start_mishna INT,
    end_mishna INT,
    PRIMARY KEY (time4mishna_shiur_id),
    FOREIGN KEY (start_mishna) REFERENCES mishnayos_table(mishna_id),
    FOREIGN KEY (end_mishna) REFERENCES mishnayos_table(mishna_id)
);

time4mishna_daily_schedule (
  daily_schedule_id INT NOT NULL AUTO_INCREMENT,
  shiur_type VARCHAR(25),
  time4mishna_shiur_id INT,
  date_id INT NOT NULL,
  additional_notice VARCHAR(255),
  PRIMARY KEY (daily_schedule_id),
  FOREIGN KEY (time4mishna_shiur_id) REFERENCES time4mishna_shiurim(time4mishna_shiur_id),
  FOREIGN KEY (date_id) REFERENCES dates_table(date_id)
);
```
