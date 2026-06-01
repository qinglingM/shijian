package com.zihelee.shijian;

import android.Manifest;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "PhotoLibrary",
    permissions = {
        @Permission(alias = "legacyStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class PhotoLibraryPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "legacyStoragePermissionCallback");
            return;
        }

        saveImageToLibrary(call);
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        byte[] imageData;
        try {
            imageData = decodeDataUrl(call.getString("dataUrl"));
        } catch (IllegalArgumentException error) {
            call.reject("Invalid image data", "INVALID_IMAGE", error);
            return;
        }

        try {
            File directory = new File(getContext().getCacheDir(), "shared-posters");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IOException("Unable to create shared poster directory");
            }

            File file = new File(directory, createFilename());
            try (OutputStream output = new FileOutputStream(file)) {
                output.write(imageData);
            }

            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("image/png");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.setClipData(ClipData.newUri(getContext().getContentResolver(), "ShiJian poster", uri));
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(share, "分享海报"));
            call.resolve();
        } catch (IOException | RuntimeException error) {
            call.reject("Unable to share image", "SHARE_FAILED", error);
        }
    }

    @PermissionCallback
    private void legacyStoragePermissionCallback(PluginCall call) {
        if (getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            call.reject("Photo library access denied", "PERMISSION_DENIED");
            return;
        }

        saveImageToLibrary(call);
    }

    private void saveImageToLibrary(PluginCall call) {
        byte[] imageData;
        try {
            imageData = decodeDataUrl(call.getString("dataUrl"));
        } catch (IllegalArgumentException error) {
            call.reject("Invalid image data", "INVALID_IMAGE", error);
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveScopedImage(imageData);
            } else {
                saveLegacyImage(imageData);
            }
            call.resolve();
        } catch (IOException | RuntimeException error) {
            call.reject("Unable to save image", "SAVE_FAILED", error);
        }
    }

    private byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null) {
            throw new IllegalArgumentException("Missing data URL");
        }

        int separator = dataUrl.indexOf(',');
        if (separator < 0 || separator == dataUrl.length() - 1) {
            throw new IllegalArgumentException("Malformed data URL");
        }

        byte[] imageData = Base64.decode(dataUrl.substring(separator + 1), Base64.DEFAULT);
        if (imageData.length == 0) {
            throw new IllegalArgumentException("Empty image data");
        }
        return imageData;
    }

    private void saveScopedImage(byte[] imageData) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, createFilename());
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ShiJian");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
        if (uri == null) {
            throw new IOException("Unable to create image");
        }

        try {
            writeImage(resolver, uri, imageData);
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, ready, null, null);
        } catch (IOException | RuntimeException error) {
            resolver.delete(uri, null, null);
            throw error;
        }
    }

    private void saveLegacyImage(byte[] imageData) throws IOException {
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "ShiJian");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Unable to create Pictures directory");
        }

        File file = new File(directory, createFilename());
        try (OutputStream output = new FileOutputStream(file)) {
            output.write(imageData);
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, file.getName());
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.DATA, file.getAbsolutePath());
        getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
    }

    private void writeImage(ContentResolver resolver, Uri uri, byte[] imageData) throws IOException {
        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) {
                throw new IOException("Unable to open image output");
            }
            output.write(imageData);
        }
    }

    private String createFilename() {
        return "shijian-poster-" + System.currentTimeMillis() + ".png";
    }
}
