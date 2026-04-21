# Public Assets

This folder is served at `/public`.

Member avatars are detected automatically by `/api/members`:

- Use the member `key` as the image filename, for example `kaixin.png`.
- Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.

The first exact `member_key` filename match is returned as `avatar_url`.
