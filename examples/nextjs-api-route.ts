// app/api/domains/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EppClient } from 'epp-client';

export async function POST(request: NextRequest) {
  try {
    const { domains } = await request.json();

    if (!domains || !Array.isArray(domains)) {
      return NextResponse.json(
        { error: 'Domains array is required' },
        { status: 400 }
      );
    }

    const client = new EppClient({
      server: process.env.EPP_SERVER!,
      username: process.env.EPP_USERNAME!,
      password: process.env.EPP_PASSWORD!,
    });

    const loginResult = await client.login();
    if (!loginResult.success) {
      return NextResponse.json(
        { error: 'EPP authentication failed' },
        { status: 401 }
      );
    }

    const result = await client.domainCheck(domains);
    
    await client.logout();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Domain check error:', error);
    return NextResponse.json(
      { error: 'Domain check failed', details: error.message },
      { status: 500 }
    );
  }
}

// app/api/contacts/create/route.ts
export async function POST(request: NextRequest) {
  try {
    const contactData = await request.json();

    const client = new EppClient({
      server: process.env.EPP_SERVER!,
      username: process.env.EPP_USERNAME!,
      password: process.env.EPP_PASSWORD!,
    });

    await client.login();
    const result = await client.contactCreate(contactData);
    await client.logout();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Contact create error:', error);
    return NextResponse.json(
      { error: 'Contact creation failed', details: error.message },
      { status: 500 }
    );
  }
}