; ZhanX DentalCare client installer customisations.
; The client stores only its server address and (when available) an encrypted
; refresh token in the operating system credential store. Clinic data and
; backups live on the clinic server and are never removed by uninstalling
; this desktop client.

!macro customInstall
  WriteRegStr HKCU "Software\ZhanX\DentalCare" "ClientInstalled" "1"
!macroend

!macro customUnInstall
  ; Intentionally keep user settings (server address) so a reinstall reconnects
  ; to the same clinic server. No patient or financial data is stored locally.
!macroend
