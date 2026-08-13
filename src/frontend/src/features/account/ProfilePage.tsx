import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BsCamera, BsPersonCircle, BsTrash } from 'react-icons/bs';
import {
  useDeleteProfilePhotoMutation,
  useUpdateProfileMutation,
  useUploadProfilePhotoMutation
} from './account.api';
import { AccountLayout } from './AccountNav';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { bootstrapSession, selectUser } from '@/features/auth/authSlice';
import { profileSchema, type ProfileValues } from '@/lib/schemas';
import { validateImageFile } from '@/lib/imageValidation';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import { useConfirm } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';

/**
 * Profile.
 *
 * The EJS version was 1,729 lines across two overlapping pages - `/profile`
 * with inline editing and `/profile/edit` with a form, both writing the same
 * two fields. This is one page; `/profile/edit` redirects here.
 *
 * The email-change OTP flow is deliberately not carried over yet: it is one of
 * the remaining express-session dependencies, and moving it belongs with that
 * work rather than being half-ported here. The email is shown read-only with a
 * note.
 */
const ProfilePage = () => {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAppSelector(selectUser('user'));

  const [updateProfile] = useUpdateProfileMutation();
  const [uploadPhoto, { isLoading: isUploading }] = useUploadProfilePhotoMutation();
  const [deletePhoto] = useDeleteProfilePhotoMutation();

  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? '' });
  }, [user, reset]);

  const onSubmit = async (values: ProfileValues) => {
    try {
      await updateProfile({ name: values.name, phone: values.phone || '' }).unwrap();
      // The session carries the name shown in the navbar, so it has to be
      // re-read rather than left stale.
      await dispatch(bootstrapSession('user'));
      toast.success('Profile updated');
      setEditing(false);
    } catch (caught) {
      toast.fromError(caught, 'Could not save your profile.');
    }
  };

  const onPhotoChosen = async (file: File) => {
    const check = validateImageFile(file);

    if (!check.valid) {
      toast.error(check.error ?? 'That file is not a supported image.');
      return;
    }

    try {
      await uploadPhoto(file).unwrap();
      await dispatch(bootstrapSession('user'));
      toast.success('Photo updated');
    } catch (caught) {
      toast.fromError(caught, 'Could not upload that photo.');
    }
  };

  return (
    <AccountLayout title="Your profile">
      <div className="rounded-lg border border-line bg-white p-6">
        <div className="flex flex-wrap items-center gap-5">
          {user?.profilePhoto ? (
            <img
              src={user.profilePhoto}
              alt=""
              className="size-24 rounded-full object-cover"
            />
          ) : (
            <BsPersonCircle className="size-24 text-line" aria-hidden="true" />
          )}

          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onPhotoChosen(file);
                // Reset so choosing the same file twice still fires a change.
                event.target.value = '';
              }}
            />

            <Button
              size="sm"
              variant="outline"
              loading={isUploading}
              icon={<BsCamera className="size-4" aria-hidden="true" />}
              onClick={() => fileInput.current?.click()}
            >
              {user?.profilePhoto ? 'Change photo' : 'Add photo'}
            </Button>

            {user?.profilePhoto && (
              <Button
                size="sm"
                variant="ghost"
                icon={<BsTrash className="size-4" aria-hidden="true" />}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Remove your photo?',
                    confirmLabel: 'Remove',
                    tone: 'danger'
                  });
                  if (!ok) return;

                  try {
                    await deletePhoto().unwrap();
                    await dispatch(bootstrapSession('user'));
                    toast.success('Photo removed');
                  } catch (caught) {
                    toast.fromError(caught, 'Could not remove your photo.');
                  }
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 max-w-md space-y-4">
          <TextField
            label="Name"
            required
            disabled={!editing}
            error={errors.name?.message}
            {...register('name')}
          />

          <TextField
            label="Phone"
            inputMode="numeric"
            disabled={!editing}
            hint="Optional"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="profile-email"
              value={user?.email ?? ''}
              readOnly
              disabled
              className="mt-1.5 w-full rounded-md border border-line bg-card px-3 py-2.5 text-ink-muted"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Changing your email needs a verification code. That flow is still on the old
              pages.
            </p>
          </div>

          {editing ? (
            <div className="flex gap-3">
              <Button type="submit" loading={isSubmitting}>
                Save changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset({ name: user?.name ?? '', phone: user?.phone ?? '' });
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )}
        </form>
      </div>
    </AccountLayout>
  );
};

export default ProfilePage;
