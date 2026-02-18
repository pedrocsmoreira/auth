$ErrorActionPreference = "SilentlyContinue"
$apiKey    = "dev-login-key-change-me"
$masterKey = "dev-master-key-change-me"
$base      = "http://localhost:3000"

function Get-Data($r) { ($r.Content | ConvertFrom-Json).data }

# 1. Health
$r = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing
Write-Host "[1] Health: $($r.StatusCode)"

# 2. Login
$r = Invoke-WebRequest -Uri "$base/login" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body '{"username":"admin","password":"Test1234!"}'
$d = Get-Data $r
$access = $d.accessToken ; $refresh = $d.refreshToken
Write-Host "[2] Login: $($r.StatusCode) | access=$(if($access){'OK'}else{'MISSING'}) refresh=$(if($refresh){'OK'}else{'MISSING'})"

# 2b. Admin must change password (force_password_change=true after seed)
$r = Invoke-WebRequest -Uri "$base/login/change-password" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey;"Authorization"="Bearer $access"} `
     -Body '{"currentPassword":"Test1234!","newPassword":"Admin@New1!"}'
Write-Host "[2b] Change password: $($r.StatusCode)"

# Re-login with new password to get a clean token (force_password_change=false now)
$r = Invoke-WebRequest -Uri "$base/login" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body '{"username":"admin","password":"Admin@New1!"}'
$d = Get-Data $r
$access = $d.accessToken ; $refresh = $d.refreshToken
Write-Host "[2c] Re-login after pw change: $($r.StatusCode)"

# 3. Paginated user list
$url3 = $base + "/user" + "?page=1" + "&limit=5"
$r = Invoke-WebRequest -Uri $url3 -UseBasicParsing `
     -Headers @{"x-api-key"=$masterKey;"Authorization"="Bearer $access"}
$d = Get-Data $r
Write-Host "[3] GET /user: $($r.StatusCode) | total=$($d.total) pages=$($d.pages) count=$($d.users.Count)"

# 4. Refresh with rotation
$r = Invoke-WebRequest -Uri "$base/login/refresh" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body ('{"refreshToken":"' + $refresh + '"}')
$d = Get-Data $r
$newAccess = $d.accessToken ; $newRefresh = $d.refreshToken
Write-Host "[4] Refresh: $($r.StatusCode) | newAccess=$(if($newAccess){'OK'}else{'MISSING'}) newRefresh=$(if($newRefresh){'OK'}else{'MISSING'})"

# 5. Old token must be revoked
try {
    $r = Invoke-WebRequest -Uri "$base/login/refresh" -Method POST -UseBasicParsing `
         -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
         -Body ('{"refreshToken":"' + $refresh + '"}')
    Write-Host "[5] Old token: $($r.StatusCode) BUG - expected 401"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[5] Old token rejected: $code $(if($code -eq 401){'PASS'}else{'FAIL'})"
}

# 6. Logout-all
$r = Invoke-WebRequest -Uri "$base/login/logout-all" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey;"Authorization"="Bearer $newAccess"}
Write-Host "[6] Logout-all: $($r.StatusCode) | $((Get-Data $r).message)"

# 7. New refresh token must also be revoked now
try {
    $r = Invoke-WebRequest -Uri "$base/login/refresh" -Method POST -UseBasicParsing `
         -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
         -Body ('{"refreshToken":"' + $newRefresh + '"}')
    Write-Host "[7] Post-logout-all refresh: $($r.StatusCode) BUG"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[7] Post-logout-all refresh rejected: $code $(if($code -eq 401){'PASS'}else{'FAIL'})"
}

# 8. Re-login as admin to get fresh token
$r = Invoke-WebRequest -Uri "$base/login" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body '{"username":"admin","password":"Admin@New1!"}'
$adminAccess = (Get-Data $r).accessToken

# 9. Create testuser
$r = Invoke-WebRequest -Uri "$base/user" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$masterKey;"Authorization"="Bearer $adminAccess"} `
     -Body '{"username":"testuser"}'
$ud = Get-Data $r
$userId = $ud.id ; $inviteToken = $ud.inviteToken
Write-Host "[8] Create user: $($r.StatusCode) | id=$userId invite=$(if($inviteToken){'OK'}else{'MISSING'})"

# 10. Set testuser password via reset-password
$r = Invoke-WebRequest -Uri "$base/login/reset-password" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body ('{"token":"' + $inviteToken + '","newPassword":"UserPass123!"}')
Write-Host "[9] Set testuser password: $($r.StatusCode)"

# 11. Login as testuser
$r = Invoke-WebRequest -Uri "$base/login" -Method POST -UseBasicParsing `
     -Headers @{"Content-Type"="application/json";"x-api-key"=$apiKey} `
     -Body '{"username":"testuser","password":"UserPass123!"}'
$userAccess = (Get-Data $r).accessToken
Write-Host "[10] testuser login: $($r.StatusCode)"

# 12. Deactivate testuser
$r = Invoke-WebRequest -Uri "$base/user/$userId/deactivate" -Method POST -UseBasicParsing `
     -Headers @{"x-api-key"=$masterKey;"Authorization"="Bearer $adminAccess"}
Write-Host "[11] Deactivate: $($r.StatusCode) | $((Get-Data $r).message)"

# 13. Deactivated user must be blocked
try {
    $r = Invoke-WebRequest -Uri "$base/user/$userId" -UseBasicParsing `
         -Headers @{"x-api-key"=$masterKey;"Authorization"="Bearer $userAccess"}
    Write-Host "[12] Deactivated access: $($r.StatusCode) BUG"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[12] Deactivated blocked: $code $(if($code -eq 403){'PASS'}else{'FAIL'})"
}

# 14. Reactivate testuser
$r = Invoke-WebRequest -Uri "$base/user/$userId/reactivate" -Method POST -UseBasicParsing `
     -Headers @{"x-api-key"=$masterKey;"Authorization"="Bearer $adminAccess"}
Write-Host "[13] Reactivate: $($r.StatusCode) | $((Get-Data $r).message)"

# 15. Rate limit - 11 bad logins
Write-Host "[14] Rate limit: 11 bad logins..."
$hdr = @{"Content-Type"="application/json";"x-api-key"=$apiKey}
$bod = '{"username":"nobody","password":"wrong"}'
$last = 0
for ($i = 1; $i -le 11; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$base/login" -Method POST -UseBasicParsing -Headers $hdr -Body $bod
        $last = $r.StatusCode
    } catch {
        $last = $_.Exception.Response.StatusCode.value__
    }
}
Write-Host "     req#11 = $last $(if($last -eq 429){'PASS (rate limited)'}else{'FAIL (expected 429)'})"

Write-Host ""
Write-Host "All tests complete."
