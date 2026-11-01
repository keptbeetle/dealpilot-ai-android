param(
    [Parameter(Mandatory=$true)][string]$Path,
    [ValidateSet('Protect','Check')][string]$Action = 'Check'
)
$ErrorActionPreference = 'Stop'
try {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Private storage cannot be a reparse point.'
    }
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    if ($Action -eq 'Protect') {
        if ($item.PSIsContainer) {
            $acl = New-Object Security.AccessControl.DirectorySecurity
            $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
        } else {
            $acl = New-Object Security.AccessControl.FileSecurity
            $inheritance = [Security.AccessControl.InheritanceFlags]::None
        }
        $acl.SetOwner($owner)
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($identity in @($owner, $system)) {
            $rule = New-Object Security.AccessControl.FileSystemAccessRule(
                $identity, [Security.AccessControl.FileSystemRights]::FullControl,
                $inheritance, [Security.AccessControl.PropagationFlags]::None,
                [Security.AccessControl.AccessControlType]::Allow
            )
            $acl.AddAccessRule($rule)
        }
        $item.SetAccessControl($acl)
    }
    $acl = $item.GetAccessControl()
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value) {
        throw 'Private storage has another owner.'
    }
    $ownerHasAccess = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
        if ($rule.IdentityReference.Value -notin @($owner.Value, $system.Value)) {
            throw 'Private storage grants access to another identity.'
        }
        if ($rule.IdentityReference.Value -eq $owner.Value -and
            ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq
            [Security.AccessControl.FileSystemRights]::FullControl) { $ownerHasAccess = $true }
    }
    if (-not $ownerHasAccess) { throw 'Private storage lacks owner access.' }
    exit 0
} catch {
    [Console]::Error.WriteLine('Private storage access protection could not be established or verified.')
    exit 1
}
