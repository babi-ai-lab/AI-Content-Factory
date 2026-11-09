# ParsPack PHP release acceptance checklist

## Infrastructure
- [ ] Separate MySQL database/user created in cPanel
- [ ] PHP 8.1+ selected for the app subdomain
- [ ] PDO MySQL, mbstring and fileinfo enabled
- [ ] Outbound HTTPS from PHP verified
- [ ] HTTPS certificate valid on app.eltbabak.ir
- [ ] Private storage directory writable and not directly web-accessible
- [ ] Production config installed outside public web root
- [ ] Existing WordPress database and document root remain untouched

## Product
- [ ] Register, verify email, login, logout and password recovery
- [ ] Two-user data-isolation tests pass
- [ ] Text generation and provider failure handling pass
- [ ] Content history, versions, restore and export pass
- [ ] Brand profiles and content quality checks pass
- [ ] Campaigns, metrics, analytics and calendar pass
- [ ] Media generation, private storage, quota and deletion pass
- [ ] Account export and deletion pass
- [ ] Mobile and desktop browser tests pass

## Operations
- [ ] Error logging without secrets or personal content
- [ ] Rate limits and abuse controls enabled
- [ ] Automated database and file backups configured
- [ ] Restore drill completed
- [ ] Health monitoring and admin diagnostics pass
- [ ] Rollback path documented and tested

No production cutover before every mandatory item is checked.
