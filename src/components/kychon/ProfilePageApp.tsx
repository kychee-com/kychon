'use client';

import { Camera, CircleUserRound, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/kychon/ui';
import { get, patch } from '@/lib/api';
import { getSession, isAuthenticated, setSessionMember } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { ready } from '@/lib/config';
import { uploadFileContentAddressed } from '@/lib/storage-upload';
import { showToast } from '@/lib/toast-events';
import type { Member, MemberCustomField } from '@/schemas/member';

interface ProfileFormState {
  displayName: string;
  bio: string;
  customFields: Record<string, string>;
}

const EMPTY_FORM: ProfileFormState = {
  displayName: '',
  bio: '',
  customFields: {},
};

function valueFor(field: MemberCustomField, values: Record<string, string>): string {
  return String(values[field.field_name] ?? '');
}

function normalizeOptions(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => String(option)).filter(Boolean) : [];
}

function memberFromSession(): Member | null {
  const member = getSession()?.user?.member;
  return member?.id ? (member as Member) : null;
}

function writeMemberToSession(member: Member): void {
  // Overlay the saved profile onto the actor-backed session view so getSession()
  // (chrome avatar / name, gated islands) reflects the edit without a reload.
  if (!getSession()) return;
  setSessionMember(member);
}

export default function ProfilePageApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [fields, setFields] = useState<MemberCustomField[]>([]);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ready;
      const signedIn = isAuthenticated();
      setAuthenticated(signedIn);
      if (!signedIn) {
        setMember(null);
        setFields([]);
        setForm(EMPTY_FORM);
        return;
      }

      const currentMember = memberFromSession();
      if (!currentMember) {
        setError('Active member access is required to edit your profile.');
        return;
      }

      setMember(currentMember);
      setAvatarUrl(currentMember.avatar_url || '');
      setForm({
        displayName: currentMember.display_name || '',
        bio: currentMember.bio || '',
        customFields: Object.fromEntries(
          Object.entries(currentMember.custom_fields || {}).map(([key, value]) => [key, String(value ?? '')]),
        ),
      });

      const rows = (await get('member_custom_fields?order=position.asc')) as MemberCustomField[];
      setFields(rows);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    document.addEventListener('wl-auth-changed', loadProfile);
    document.addEventListener('wl-locale-changed', loadProfile);
    return () => {
      document.removeEventListener('wl-auth-changed', loadProfile);
      document.removeEventListener('wl-locale-changed', loadProfile);
    };
  }, [loadProfile]);

  function setCustomField(fieldName: string, value: string) {
    setForm((current) => ({
      ...current,
      customFields: { ...current.customFields, [fieldName]: value },
    }));
  }

  function validateProfile(): boolean {
    if (!form.displayName.trim()) {
      showToast('Display name is required.', 'warning');
      return false;
    }

    const missing = fields.find((field) => field.required && !valueFor(field, form.customFields).trim());
    if (missing) {
      showToast(`${missing.field_label} is required.`, 'warning');
      return false;
    }

    return true;
  }

  async function saveProfile() {
    if (!member || !validateProfile()) return;

    setSaving(true);
    setSaved(false);
    try {
      const body = {
        display_name: form.displayName.trim(),
        bio: form.bio,
        custom_fields: form.customFields,
      };
      await patch(`members?id=eq.${member.id}`, body);
      const updatedMember = { ...member, ...body };
      setMember(updatedMember);
      writeMemberToSession(updatedMember);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Could not save your profile.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!member) return;
    const session = getSession();
    setUploadingAvatar(true);
    try {
      const { url } = await uploadFileContentAddressed(file, {
        keyPrefix: `avatars/${member.id}`,
        authToken: session?.access_token,
      });
      await patch(`members?id=eq.${member.id}`, { avatar_url: url });
      const updatedMember = { ...member, avatar_url: url };
      setMember(updatedMember);
      setAvatarUrl(url);
      writeMemberToSession(updatedMember);
      showToast('Avatar updated', 'success');
    } catch (uploadError) {
      showToast(uploadError instanceof Error ? uploadError.message : 'Avatar upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function renderCustomField(field: MemberCustomField) {
    const id = `profile-custom-${field.field_name}`;
    const value = valueFor(field, form.customFields);

    if (field.field_type === 'textarea') {
      return (
        <div className="space-y-2" key={field.id}>
          <Label htmlFor={id}>{field.field_label}</Label>
          <Textarea id={id} onChange={(event) => setCustomField(field.field_name, event.target.value)} value={value} />
        </div>
      );
    }

    if (field.field_type === 'select') {
      const labelId = `${id}-label`;
      return (
        <div className="space-y-2" key={field.id}>
          <div className="text-sm font-medium" id={labelId}>
            {field.field_label}
          </div>
          <Select
            onValueChange={(nextValue) => setCustomField(field.field_name, nextValue === '__none' ? '' : nextValue)}
            value={value || '__none'}
          >
            <SelectTrigger aria-labelledby={labelId} id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {normalizeOptions(field.options).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="space-y-2" key={field.id}>
        <Label htmlFor={id}>{field.field_label}</Label>
        <Input
          id={id}
          onChange={(event) => setCustomField(field.field_name, event.target.value)}
          placeholder={field.field_type === 'date' ? 'YYYY-MM-DD' : undefined}
          type={field.field_type === 'url' ? 'url' : 'text'}
          value={value}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-1/2 rounded-md bg-muted" />
          <div className="h-4 w-2/3 rounded-md bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="mx-auto h-20 w-20 rounded-full bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
          <div className="h-24 rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!authenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Sign in as a member to edit your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
            Sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>Update the information other members see in the portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {avatarUrl ? (
              <img alt="Avatar" className="h-full w-full object-cover" src={avatarUrl} />
            ) : (
              <CircleUserRound className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <Input
            ref={fileInputRef}
            accept="image/*"
            aria-label="Upload avatar"
            className="hidden"
            id="profile-avatar-upload"
            name="profile_avatar_upload"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
            tabIndex={-1}
            type="file"
          />
          <Button disabled={uploadingAvatar} onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Change avatar
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-name">Display Name</Label>
          <Input
            id="profile-name"
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            required
            value={form.displayName}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-bio">Bio</Label>
          <Textarea id="profile-bio" onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} value={form.bio} />
        </div>

        {fields.length > 0 ? <div className="space-y-4">{fields.map(renderCustomField)}</div> : null}

        <Button disabled={saving || !!error} onClick={saveProfile} type="button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}
