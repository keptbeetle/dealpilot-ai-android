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
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $owner = $identity.User
    $system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    $acl = $item.GetAccessControl()
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value) {
        # Elevated Windows tokens can create files owned by their default owner
        # group (for example Administrators on hosted runners). Normalize only
        # that known creator-owner on an explicit Protect call. Check stays
        # read-only and strict; unrelated owners are never taken over.
        if ($Action -eq 'Protect' -and
            $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $identity.Owner.Value) {
            $acl.SetOwner($owner)
        } else {
            throw 'Private storage has another owner.'
        }
    }
    if ($Action -eq 'Protect') {
        if ($item.PSIsContainer) {
            $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
        } else {
            $inheritance = [Security.AccessControl.InheritanceFlags]::None
        }
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($rule in $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])) {
            $acl.RemoveAccessRuleSpecific($rule)
        }
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
