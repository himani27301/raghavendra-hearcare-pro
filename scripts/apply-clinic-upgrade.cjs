const fs = require('fs');

function patchFile(path, patches) {
  let s = fs.readFileSync(path, 'utf8');
  for (const p of patches) {
    if (p.guard && s.includes(p.guard)) {
      console.log(`SKIP ${path}: ${p.label}`);
      continue;
    }
    if (!s.includes(p.from)) {
      throw new Error(`Could not find patch target for ${p.label} in ${path}`);
    }
    s = s.replace(p.from, p.to);
    console.log(`PATCH ${path}: ${p.label}`);
  }
  fs.writeFileSync(path, s, 'utf8');
}

patchFile('server/src/index.js', [
  {
    label: 'staff self-service password change endpoint',
    guard: "/api/auth/change-password",
    from: "app.post('/api/auth/patient-login', async (req, res) => {",
    to: `app.post('/api/auth/change-password', auth, allow('admin', 'doctor', 'receptionist'), async (req, res) => {\n  const currentPassword = String(req.body.currentPassword || '');\n  const newPassword = String(req.body.newPassword || '');\n  if (newPassword.length < 10) return res.status(400).json({ message: 'New password must be at least 10 characters' });\n  const user = await User.findById(req.user.id);\n  if (!user) return res.status(404).json({ message: 'Account not found' });\n  const valid = await bcrypt.compare(currentPassword, user.passwordHash || '');\n  if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });\n  user.passwordHash = await bcrypt.hash(newPassword, 12);\n  await user.save();\n  await audit(req, 'CHANGE_PASSWORD', 'User', user._id);\n  res.json({ ok: true, message: 'Password updated successfully' });\n});\n\napp.post('/api/auth/patient-login', async (req, res) => {`
  },
  {
    label: 'doctor dashboard appointment isolation',
    guard: "const visibleAppointments = req.user.role === 'doctor'",
    from: "  const todayApps = appointments.filter(a => dayKey(a.date) === today);",
    to: "  const visibleAppointments = req.user.role === 'doctor' ? appointments.filter(a => a.assignedDoctor === req.user.name) : appointments;\n  const todayApps = visibleAppointments.filter(a => dayKey(a.date) === today);"
  },
  {
    label: 'doctor appointment list isolation',
    guard: "const appointmentFilter = req.user.role === 'doctor'",
    from: "app.get('/api/appointments', auth, allow(...staffRoles), async (req, res) => res.json(dbMode === 'mongodb' ? (await Appointment.find().sort({ date: 1, time: 1 })).map(clean) : memory.appointments));",
    to: `app.get('/api/appointments', auth, allow(...staffRoles), async (req, res) => {\n  if (dbMode !== 'mongodb') return res.json(memory.appointments);\n  const appointmentFilter = req.user.role === 'doctor' ? { assignedDoctor: req.user.name } : {};\n  const rows = await Appointment.find(appointmentFilter).sort({ date: 1, time: 1 });\n  res.json(rows.map(clean));\n});`
  },
  {
    label: 'doctor-created appointment auto assignment',
    guard: "const assignedDoctor = req.user.role === 'doctor' ? req.user.name",
    from: "  const a = await Appointment.create({ ...req.body, patientName: p.name, requestedBy: 'staff', status: req.body.status || 'Pending' });",
    to: "  const assignedDoctor = req.user.role === 'doctor' ? req.user.name : (req.body.assignedDoctor || '');\n  const a = await Appointment.create({ ...req.body, assignedDoctor, patientName: p.name, requestedBy: 'staff', status: req.body.status || 'Pending' });"
  },
  {
    label: 'doctor appointment update permission',
    guard: "You can only update appointments assigned to you",
    from: "app.patch('/api/appointments/:id', auth, allow(...staffRoles), async (req, res) => { const a = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true }); await audit(req, 'UPDATE', 'Appointment', req.params.id); res.json(clean(a)); });",
    to: `app.patch('/api/appointments/:id', auth, allow(...staffRoles), async (req, res) => {\n  const existing = await Appointment.findById(req.params.id);\n  if (!existing) return res.status(404).json({ message: 'Appointment not found' });\n  if (req.user.role === 'doctor' && existing.assignedDoctor && existing.assignedDoctor !== req.user.name) return res.status(403).json({ message: 'You can only update appointments assigned to you' });\n  const update = req.user.role === 'doctor' ? { ...req.body, assignedDoctor: req.user.name } : req.body;\n  const a = await Appointment.findByIdAndUpdate(req.params.id, update, { new: true });\n  await audit(req, 'UPDATE', 'Appointment', req.params.id);\n  res.json(clean(a));\n});`
  }
]);

patchFile('web/app/page.js', [
  {
    label: 'password modal state',
    guard: "const [passwordOpen, setPasswordOpen]",
    from: "  const [mobileOpen, setMobileOpen] = useState(false);",
    to: "  const [mobileOpen, setMobileOpen] = useState(false);\n  const [passwordOpen, setPasswordOpen] = useState(false);"
  },
  {
    label: 'sidebar password button',
    guard: "title=\"Change password\"",
    from: "      <div className=\"side-bottom\"><div className=\"user-mini\"><div className=\"avatar\">{session.user.name?.[0]}</div><div><b>{session.user.name}</b><span>{session.user.role}</span></div></div><button className=\"icon-btn\" onClick={onLogout}><LogOut size={18}/></button></div>",
    to: "      <div className=\"side-bottom\"><div className=\"user-mini\"><div className=\"avatar\">{session.user.name?.[0]}</div><div><b>{session.user.name}</b><span>{session.user.role}</span></div></div><div className=\"inline-actions\">{session.user.role!=='patient'&&<button className=\"icon-btn\" title=\"Change password\" onClick={()=>setPasswordOpen(true)}><ShieldCheck size={17}/></button>}<button className=\"icon-btn\" title=\"Sign out\" onClick={onLogout}><LogOut size={18}/></button></div></div>"
  },
  {
    label: 'password modal mount and component',
    guard: "function PasswordModal({ token, onClose })",
    from: "    </section>\n  </div>;\n}\n\nfunction Dashboard({ token, user, setView }) {",
    to: `    </section>\n    {passwordOpen&&session.user.role!=='patient'&&<PasswordModal token={session.token} onClose={()=>setPasswordOpen(false)}/>}\n  </div>;\n}\n\nfunction PasswordModal({ token, onClose }) {\n  const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');\n  const save=async()=>{\n    if(newPassword!==confirmPassword){setError('New passwords do not match');return;}\n    if(newPassword.length<10){setError('Use at least 10 characters');return;}\n    setBusy(true);setError('');\n    try{await api('/auth/change-password',token,{method:'POST',body:JSON.stringify({currentPassword,newPassword})});alert('Password updated successfully');onClose();}\n    catch(e){setError(e.message);}finally{setBusy(false);}\n  };\n  return <Modal title=\"Change password\" subtitle=\"Use a unique password for your clinic account\" onClose={onClose}><div className=\"form-grid\"><label className=\"span2\">Current password<input type=\"password\" autoComplete=\"current-password\" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>New password<input type=\"password\" autoComplete=\"new-password\" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Confirm new password<input type=\"password\" autoComplete=\"new-password\" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label></div>{error&&<div className=\"error\">{error}</div>}<button className=\"primary wide\" disabled={busy} onClick={save}>{busy?'Updating…':'Update password'}</button></Modal>;\n}\n\nfunction Dashboard({ token, user, setView }) {`
  }
]);

console.log('Clinic workflow upgrade patch complete');
