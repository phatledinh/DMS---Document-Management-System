UPDATE users
SET password = '$2a$10$5OjzLbScdSUHVRtoDBaXduV9BNJGHLIerPPkjED0sMFvn7V7WEHk.',
    status = 'ACTIVE',
    deleted_at = NULL
WHERE email = 'admin@dms.com';
