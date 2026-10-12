-- Contact details printed in the header of tax invoices.
alter table company_profile add column if not exists email text;
alter table company_profile add column if not exists phone text;
update company_profile set
  address = '111, Delhi Advertising, Mayur Vihar -1 (Ext), Delhi - 110091',
  email = 'connect@laavinfra.com',
  phone = '(+91) 98115 11558';
